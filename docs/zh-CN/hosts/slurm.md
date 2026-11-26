[English](../../hosts/slurm.md) | 简体中文
> 本文译自英文版（commit a5ff61d7），内容以英文版为准。

<a id="running-on-slurm"></a>
# 在 Slurm 上运行

在 Slurm 上，一个 batch 就是一个 `sbatch` 作业：一个节点，一个 `srun` step。在登录节点上，`roboteam slurm-submit` 把一次提交冻结下来（已提交的源码、资源文件、配置、回执、作业脚本），再放进队列。作业到了计算节点上，先把这份提交 stage 到节点本地的 scratch，在那里准备并运行 batch；step 结束后，把一个校验过的 evidence ZIP 拷回提交目录。正在使用的数据库、会话和临时文件从不碰共享存储。

本文用到几个词：*staging* 指把冻结的提交拷到节点上，*stage-out* 指把结果拷回来。*egress* 指作业访问模型服务商的出站网络通道。

[`docs/hosts/examples/slurm.toml`](../../hosts/examples/slurm.toml) 是一份起步用的 site TOML（36 次运行，Codex 订阅）：把它复制成一个不进版本库的文件（这里叫 `site.toml`），再按需修改。

<a id="1-prerequisites"></a>
## 1. 准备条件

- 一个 Linux 登录节点和若干计算节点，它们看到的是同一份共享存储，上面有 checkout 和它的 `.venv`、harness CLI，以及 policy environment。harness 是包住模型的 coding-agent 程序。作业本身不装任何东西。
- `PATH` 里有 `sbatch`、`srun`、`squeue` 和 `scancel`（有些集群要先 `module load slurm`）。
- Slurm 的进程跟踪（cgroup）要能管住 job step 的所有子孙进程，包括脱离出去的 CLI 进程。
- 节点本地的 scratch：`SLURM_TMPDIR` 或 `slurm.scratch_root`。作业只接受 ext2/ext3、xfs、btrfs、tmpfs、overlayfs 或 zfs，而 policy environment 不允许运行放在 `/tmp` 下，所以要把 `slurm.scratch_root` 设成 `/tmp` 以外的一个节点本地目录，比如 `/var/tmp`。
- 计算节点的 `PATH` 最前面是锁定版本的 CLI（见 `roboteam/runtime/run/versions.py`：Codex 0.165.0，Claude Code 2.1.316）。共享账号自己装的那份，版本可能会漂；版本不对，每次运行都会拒绝启动。
- Claude Code：如果 user namespace 可用，计算节点的 `PATH` 里要有 `bwrap` 和 `socat`（Bash 就跑在 Claude Code 的 bubblewrap 沙箱里）；否则要有 Landlock ABI 4 和 `libseccomp`。
- 用 `render.device = "nvidia"` 时，需要带 EGL 的 NVIDIA 驱动。

<a id="2-install-login-node"></a>
## 2. 安装（登录节点）

```sh
git clone https://github.com/changxuanfan/RoboTeam.git
cd RoboTeam
uv sync --locked
.venv/bin/roboteam bootstrap
```

要在 Linux 上安装，绝不能把 Mac 上的 `.venv` 拷过来。`slurm-submit` 冻结的是 `git archive HEAD`，所以已跟踪的文件有未提交的改动时，它会拒绝执行。

<a id="3-credentials"></a>
## 3. 凭据

`.env` 放在 checkout 的根目录，权限 0600（`cp .env.example .env && chmod 600 .env`）。有三种方式：

| 方式 | 要设什么 | 作业怎么拿到 |
| --- | --- | --- |
| API key（Codex `sol`、Claude `opus`、第三方模型） | 在 `.env` 里写模型的 `env_key`，比如 `OPENAI_API_KEY` | `slurm-submit` 读 `.env`，`sbatch --export=ALL` 把它传给作业 |
| Claude 订阅 token（`opus_subscription_token`、`haiku_subscription_token`） | 在 checkout 的 `.env` 里写 `CLAUDE_CODE_OAUTH_TOKEN`，**不要** export | `slurm-submit` 把它从 `sbatch` 的环境里去掉，只记下 `.env` 的路径；作业从那里读出 token，通过管道交给 CLI |
| Codex 订阅（`sol_subscription`） | `slurm.auth_mode = "subscription"`，外加一个凭据库（见下文） | 拿到资源分配后，作业给凭据库加一个租约 |

- 在 bubblewrap 下，启动环境里只要带着 token，Claude 的运行就会拒绝启动：执行 `slurm-submit` 前，先在 shell 里 unset 它。
- 在跑 bubblewrap 的地方，Claude 的 API key 模型一律拒绝（policy shell 可能读到 CLI 的环境变量）；改用订阅 token 模型。
- 密钥的值从不进入作业脚本、源码快照、配置或返回的 ZIP。

<a id="codex-credential-store"></a>
### Codex 凭据库

`slurm.credential_store` 指向一个归你所有、权限 0700 的目录。这个目录不能在任何 checkout、提交目录或 scratch 目录里，所在的存储要支持 `flock`，并且能跨节点原子 rename。只需要配置一次：

1. 用一个专用的 Codex home 登录，凭据存成文件（不要用个人的 Codex home，也不要用 macOS 钥匙串）：`CODEX_HOME=<new empty dir> codex -c 'cli_auth_credentials_store="file"' login`。
2. 只把其中的 `auth.json` 拷进凭据库，权限 0600。

从此以后，只有作业里的 Codex 会续期登录。作业先加一个非阻塞的 `flock` 租约，用最新一代的 `current.json` 初始化一个节点本地的 home，每次刷新后再原子地写回去。用同一个凭据库的作业靠 `--dependency=singleton` 排队，一次只跑一个。owner 不对、有人从外部改了 generation、写回失败，都会 fence 作业。授权撤销了，或者刚刷新完节点就挂了，可能需要重新登录；绝不能用旧的 `auth.json` 覆盖 `current.json`。没有作业在用的凭据库，可以用 `roboteam.launch.slurm.auth.migrate_store(source, destination)` 搬走。第二个 batch 可以借用现有作业的访问权限，自己不刷新登录：见 [access-only attachments](../../harness/shared-login.md)。

<a id="4-site-toml"></a>
## 4. Site TOML

```toml
schema_version = 11

[policy]
harness = "codex"
model = "sol"
system = "adaptive"

[batch]
parallel = 36

[render]
device = "nvidia"            # the default "auto" gives "nvidia" when slurm.gpus >= 1, else "cpu"

[runtime]
codex_home_scope = "task"    # API mode; "job" with slurm.auth_mode = "subscription"
codex_home = ""

[slurm]
partition = "YOUR_PARTITION"
account = "YOUR_ACCOUNT"
gpus = 1                     # 0 with render.device = "cpu"
cpus_per_task = 36
memory_gib = 128
time_limit_s = 90000         # the allocation; each run's 24 h is separate
stop_warning_s = 600         # USR1 this long before the limit: stop and collect
scratch_root = "/var/tmp"
```

- CPU 和内存是申请量，不是实测出来的容量。`slurm-submit` 从不调低 `batch.parallel`。
- `evidence.auto_collect` 和 `evidence.auto_archive` 必须保持 `true`。
- API 方式要求 `codex_home_scope = "task"`，`codex_home` 留空；每次运行都有自己的节点本地 Codex home。
- 不接受 `render.device = "native"`；用 `"nvidia"` 要求 `gpus >= 1`。无论选哪种，物理仿真都在 CPU 上跑。

<a id="5-policy-environment"></a>
## 5. Policy environment

在共享存储上构建一次，不要放在 `/tmp` 和任何 checkout 里。然后在计算节点上检查，`--scratch` 要指向 batch 将来用的 scratch 根目录下面：

```sh
.venv/bin/python -m scripts.release.build_policy_env --base /shared/roboteam-env     # login node; prints its root
srun --time=60 --cpus-per-task=4 .venv/bin/python -m scripts.release.check_policy_env \
  /shared/roboteam-env/policy-env-<id> --scratch /var/tmp
```

接着，在要执行 `slurm-submit` 的 shell 里，export base 目录，以及 agent 不许读的共享目录：

```sh
export ROBOTEAM_POLICY_ENV_BASE=/shared/roboteam-env
export ROBOTEAM_SHARED_DENY_ROOTS='["/shared"]'
```

`sbatch` 会把这两个变量传给作业，作业再在节点上准备 batch。没有 `ROBOTEAM_POLICY_ENV_BASE`（或者指定某一个构建的 `ROBOTEAM_POLICY_ENV`），作业的准备步骤会拒绝执行。详见 [policy environment](../../hosts/policy-environment.md)。

<a id="6-local-check-and-preflight"></a>
## 6. 本地检查和 preflight

```sh
srun --time=10 --gpus=1 .venv/bin/roboteam --config site.toml doctor   # on a compute node
```

| harness 和方式 | Preflight | `slurm-submit` 检查什么 |
| --- | --- | --- |
| Codex API | 在登录节点上执行 `.venv/bin/roboteam --config site.toml preflight --confirm-spend` | 一份通过的 `<runs root>/receipts/codex/compatibility/<model>/report.json`，拷进提交目录 |
| Codex 订阅 | 同一条命令，但要在资源分配里执行（`srun ...`）：需要节点本地的 scratch；用 Mac 线路时，connector 还要跑着 | 同一份报告，其中的 `job_gateway_sha256` 要和当前的 job gateway 一致 |
| Claude Code | `.venv/bin/roboteam --config site.toml preflight --confirm-spend --max-budget-usd 1` | 对应模型和 CLI 版本的两份通过的回执，拷进提交目录 |

<a id="7-submit"></a>
## 7. 提交

```sh
.venv/bin/roboteam --config site.toml slurm-submit --output runs/submissions/my-batch          # freeze only
.venv/bin/roboteam --config site.toml slurm-submit --output runs/submissions/my-batch --queue  # freeze and sbatch
```

不加 `--queue` 时，不会往队列里放任何东西，也不调用模型。输出目录必须是新的，里面有：

| 文件 | 内容 |
| --- | --- |
| `source.tar` | 已提交源码的 `git archive`（从不包含 `.env` 和运行数据） |
| `launcher/` | 冻结下来的 staging 代码，之后 checkout 怎么改都不影响它 |
| `policy-assets.tar.gz` | 校验过的资源归档 |
| `effective-config.json` | 解析后的配置，不含密钥 |
| `provider-report.json` | Codex：preflight 回执 |
| `claude-precheck.json`、`claude-blocked-precheck.json` | Claude Code：两份 preflight 回执 |
| `job.sbatch`、`submission.json` | 作业脚本；commit、文件哈希、凭据的变量名 |
| `queue.json` | 加了 `--queue` 时，记下作业 ID |

`sbatch` 拿到的参数有：`--nodes=1 --ntasks=1`，CPU、内存、时间和 GPU 的申请量，`--signal=B:USR1@<stop_warning_s>`，`--export=ALL`，以及设置了的 partition、account 和 QOS。在节点上，作业使用 `<scratch>/roboteam-<JOB_ID>/`（含 `source/`、`tmp/`、`config.json`、`local-job.json`）；这个目录已经存在时，作业拒绝复用它。

<a id="8-monitor-and-stop"></a>
## 8. 监控和停止

```sh
squeue --job JOB_ID
cat runs/submissions/my-batch/status.json          # supervisor JSON, refreshed about every 5 s
scancel --signal=USR1 --batch JOB_ID                # orderly stop: STOP markers, seal, collect
```

`roboteam status`、`stop` 和 `continue` 对提交目录不起作用：batch 在节点上。离作业时间上限还有 `stop_warning_s` 秒时，Slurm 会发同样的 USR1。直接 `scancel`、节点故障、OOM kill 或 SIGKILL，都可能让 stage-out 做不成。

每次运行从 START 起有 24 小时的有效时间，到 24 小时上限时评分。意外停下的运行会在作业里自动续跑一次。不能手动续跑：作业一结束，它的运行就从节点上消失了，新的提交会准备新的 trial。`time_limit_s` 要设得够大，覆盖 24 小时有效时间，外加启动和暂停的时间。

<a id="9-results"></a>
## 9. 结果

`srun` step 和它的所有进程退出后，stage-out 先确认没有写入方还拿着锁，再用一次 rename 发布 `results/`：

```text
runs/submissions/my-batch/
├── status.json
├── slurm-JOB_ID.log
└── results/
    ├── evidence.zip            # the collected, deduplicated evidence of every run
    ├── execution-result.json
    ├── local-job.json
    └── stage-out.json          # SHA-256 of every returned file, and the outcome
```

收集失败时，`results/` 里放的是停下的原始运行目录和会话的 JSONL 文件（不含 Codex 的认证、配置和状态），标记为 `needs_review`。stage-out 从不删节点本地的目录；stage-out 失败时，记下它报告的节点本地路径，再去问集群管理方 scratch 会保留多久。收集到了 ZIP，不代表运行成功：要逐个看每次运行的评估结果和收集问题（[evidence 的存放](../../runs/evidence-storage.md)）。

<a id="10-the-mac-route-mac-ssh"></a>
## 10. Mac 线路（`mac-ssh`）

集群连不上模型 API 时，作业可以通过 SSH 把 HTTPS 流量经一台 Mac 转出去。只放行 Anthropic 和 OpenAI/ChatGPT 主机的 443 端口；TLS 在 CLI 和服务商之间端到端加密，中途不解开。

```toml
[slurm]
egress_mode = "mac-ssh"
egress_root = "/var/tmp/USER/roboteam-egress"   # private, node-local, outside /tmp and checkouts
egress_wait_s = 120                                  # how long admission waits for the route
egress_pause_s = 172800                              # how long an outage may hold the world; 0 fences at once
```

作业进入 `RUNNING` 后，在 Mac 上保持运行下面这条命令（所在 checkout 的 `roboteam/launch/slurm/proxy.py` 要和集群上的一致）：

```sh
.venv/bin/python -m roboteam.launch.slurm.proxy connect \
  --ssh-host CLUSTER_SSH_ALIAS --job-id JOB_ID --harness codex --pause-grace-s 172800 \
  --remote-script /CLUSTER/CHECKOUT/roboteam/launch/slurm/proxy.py \
  --remote-python /CLUSTER/CHECKOUT/.venv/bin/python \
  --state-root /var/tmp/USER/roboteam-egress \
  --srun /CLUSTER/SLURM/bin/srun --slurm-conf /CLUSTER/SLURM/slurm.conf
```

- `--pause-grace-s` 必须等于 `slurm.egress_pause_s`。宽限期大于 0 时还要加 `--harness`（`claude` 或 `codex`，和作业的 harness 一致），它决定断网期间探测哪些主机：`api.anthropic.com`，或者 `chatgpt.com` 和 `auth.openai.com`。
- `--state-root` 就是作业的 `slurm.egress_root`。这条命令会在现有的资源分配里加一个只占一个 CPU 的中继 step；它不往队列里提交任何东西，连接期间不让 Mac 睡眠。状态写到 `~/.roboteam/slurm-egress/status.json`（`--status-file`）。
- 作业启动后 `egress_wait_s` 秒内，必须把这条命令跑起来，否则准入失败，失败时还没有任何运行开始计时。Claude 的作业走的也是这条线路，只是不需要凭据库。
- 断网期间仿真世界会暂停（物理和指令下发都停住，时间不计入），恢复后沿同一条线路继续。心跳过期、中继实例变了，或者断网时间超过宽限期，都会 fence 作业：作业停掉 harness、封存运行，之后就算重启隧道也解不开。所以这条线路要求 Mac 一直开着、保持登录、网络不断。
- `connect --ssh-config FILE` 可以给这条线路单独指定一份 OpenSSH 配置。要让 SSH 连接只从某个网卡出去（比如绕开 VPN），在配置里写上 `ProxyCommand python3 -I /path/proxy.py tcp-pipe --host %h --port %p --interface en0`。

<a id="limits"></a>
## 限制

- 作业结束后，它的运行**不能手动续跑**。
- **GPU 和渲染器没有退路。** 缺设备或驱动不匹配就直接报错；CUDA 的设备编号不一定等于 EGL 的设备编号。
- **Codex 跑在 Landlock ABI 1–3 上时**（比如 5.15 内核）：seccomp 还会拦截路径截断和 `openat2`，ABI 1 不允许跨目录 rename 和硬链接；要替换文件，先在同一个目录里写一个临时文件，再换过去。Claude 的 Landlock Bash 需要 ABI 4。
- **Codex 订阅作业**里，host 或共享 harness 出故障后，不会重新分派 host，也不会重建 harness；运行直接封存，等人审查。
- Mac 线路的 `egress_root` 必须放在 `/tmp` 以外，因为 policy 能读写 `/tmp`；否则准备步骤会拒绝执行。

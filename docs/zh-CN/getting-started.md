[English](../getting-started.md) | 简体中文
> 本文译自英文版（commit 2b16d5ce），内容以英文版为准。

<a id="getting-started"></a>
# 上手指南

本指南在一台机器上，从刚克隆的仓库讲起，直到跑完一次运行并收集好结果。例子用最小的 Transport 任务，时间上限 30 分钟。每条命令都说明它检查什么、失败了怎么办。所有命令都在仓库根目录下执行。

示例用的是 Claude Code。换成 Codex 的话，把 `--harness claude` 改成 `--harness codex`，再去掉 `--max-budget-usd`。

本文用到的词：

| 词 | 含义 |
| --- | --- |
| 任务（task、case） | 发布的 36 个任务之一，例如 `transport-small-l1` |
| 运行（run） | 一个 agent 团队对一个任务做一次尝试。一次运行就是一个 trial |
| Batch | 一个目录，放着准备好的若干个运行，这些运行一起启动、一起受监管 |
| Harness | 包住模型的 coding-agent 程序，agent 就在里面跑：Codex 或 Claude Code |
| 模型（model） | [`models.json`](../../models.json) 里的一个条目，例如 `sol` 或 `opus`。条目里写明服务商的模型和所需的凭据 |
| System | agent 的组织方式：`adaptive`、`single-agent`、`hierarchical` 或 `decentralized` |
| Policy | 一次运行里被测的那组 agent |
| 仿真世界（world） | 一次运行的仿真。从运行的 START 起按实时推进 |

其他术语见[文档索引](README.md#terms)。

<a id="1-what-you-need"></a>
## 1. 准备工作

| 需要 | 版本和说明 |
| --- | --- |
| 操作系统 | Apple silicon 的 macOS，或 glibc 2.28 及以上的 Linux |
| [uv](https://docs.astral.sh/uv/) | 安装 Python 3.12（见 `pyproject.toml` 里的 `requires-python`）和 `uv.lock` 锁定的包 |
| Node.js 和 npm | CI 用的是 Node.js 22。harness CLI 和 Codex host 都要用它 |
| `ffmpeg` | 开启录像（`render.record_realtime_video`）时用来编码运行的视频；部分测试也会用到 |
| Harness CLI | 必须是锁定的版本：Claude Code `2.1.316` 或 Codex `0.165.0`（见 `roboteam/runtime/run/versions.py`）。只装要跑的那个 harness |
| 渲染 | macOS：系统自带的 OpenGL。Linux：带 EGL 的 NVIDIA GPU，或在 CPU 上用 Mesa OSMesa（系统包 `libosmesa6` 或同类包） |
| Linux 沙箱 | 能用 user namespace 的机器上装 `bwrap` 和 `socat`；不能用的话，需要 Linux 6.7 及以上（Landlock ABI 4）和 `libseccomp` |
| 模型账号 | `models.json` 里某个模型的 API key，或 Claude 订阅 token |
| 网络 | `bootstrap`（下载约 190 MB 的压缩包）、构建 policy environment、访问模型服务商都要联网 |

harness CLI、MuJoCo、NumPy 或 Pillow 的版本只要和锁定版本不一致，`prepare` 和 `run` 就会拒绝执行。

<a id="2-install"></a>
## 2. 安装

```sh
git clone https://github.com/changxuanfan/RoboTeam.git
cd RoboTeam
uv sync --locked
.venv/bin/roboteam bootstrap
```

`bootstrap` 下载 `benchmark/assets.json` 里指定的资源压缩包，校验它的 SHA-256，再逐个校验哈希、还原所有文件：`benchmark/<task type>/<case>/assets/` 下的场景网格和贴图、`benchmark/hall/built/` 下建好的厂房，以及 `vendor/panda/` 下的 Franka Panda 模型。已经正确的文件直接沿用，整个过程不调用模型。出错时它会指出哪个文件或哈希对不上；不要拿别的压缩包代替。机器没有网络的话，把压缩包拷过去，再运行 `.venv/bin/python -m roboteam.launch.results.assets setup-assets --archive /path/to/archive.tar.gz`。

安装锁定版本的 harness CLI：

```sh
npm install --global @anthropic-ai/claude-code@2.1.316  # Claude Code
npm install --global @openai/codex@0.165.0              # Codex
```

锁定版本，是因为新版 CLI 可能改掉 agent 拿到的工具、提示词和 session 格式。装了别的版本时，`prepare` 和 `run` 会报出它们需要的版本。如果自己平时用的是更新的 CLI，就不要全局安装，而是把锁定的版本装在旁边，再放到 `PATH` 最前面：

```sh
npm install --prefix "$PWD/.harness-cli" @anthropic-ai/claude-code@2.1.316
export PATH="$PWD/.harness-cli/node_modules/.bin:$PATH"
```

凡是要准备、检查或启动运行的 shell，这个 CLI 都必须排在 `PATH` 最前面。用 `claude --version` 或 `codex --version` 确认。[Docker 镜像](hosts/docker.md)里已经装好了两个 CLI 的锁定版本。

Ubuntu 或 Debian 上这样安装系统包：

```sh
sudo apt-get install ffmpeg bubblewrap socat libosmesa6
```

<a id="3-credentials"></a>
## 3. 凭据

```sh
cp .env.example .env
chmod 600 .env
```

只填所用模型要读的那个变量。Git 会忽略 `.env`。变量值按字面读取；进程环境里已经设了同名变量的，以环境里的为准。

| 变量 | 谁用 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude Code 的 `opus`（Claude Code 的默认模型）和 `haiku` |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code 的 `opus_subscription_token` 和 `haiku_subscription_token`；token 用 `claude setup-token` 生成 |
| `OPENAI_API_KEY` | Codex 的 `sol`（默认模型）和 `luna` |
| `DEEPSEEK_API_KEY`、`ZAI_API_KEY`、`KIMI_API_KEY`、`KIMI_CODE_API_KEY`、`DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL`、`DASHSCOPE_ANTHROPIC_BASE_URL` | 两种 harness 下的第三方模型 |

凭据放在 `.env` 里，不要在 shell 里 export：运行会自己读这个文件，Claude 订阅 token 也是通过管道交给 CLI 的，agent 的任何 shell 都读不到它。凭据绝不能写进 TOML 文件、命令参数或提交里。

有两类模型用登录状态代替变量，不用在 `.env` 里填任何东西：

- **Claude 订阅，已保存的登录**（`opus_subscription`、`haiku_subscription`）：就是之前用 Claude Code 登录过的那个账号。在 `preflight` 和 `prepare` 之前指定它的目录，并且不要设置 `CLAUDE_CONFIG_DIR`：

  ```sh
  export ROBOTEAM_CLAUDE_HOME="$HOME/.claude"
  claude auth status --json          # "loggedIn": true
  ```

  详情，以及用 `CLAUDE_CONFIG_DIR` 登录时的做法，见[已保存的登录](../harness/claude-code.md#saved-login)。
- **ChatGPT 套餐**（`sol_subscription`、`luna_subscription` 和其他 `*_subscription` 的 Codex 模型）：本项目从不使用你个人的 `~/.codex`。在项目专用的 Codex home 里登录一次，再在 site TOML 里选用共享的 home：

  ```sh
  CODEX_HOME=~/.roboteam/codex-home codex login
  CODEX_HOME=~/.roboteam/codex-home codex login status
  ```

  ```toml
  [runtime]
  codex_home_scope = "shared"
  ```

  详情见 [Codex 认证](../harness/codex.md#authentication)。

订阅有用量上限。额度用完后，`preflight` 会失败并给出服务商的提示，正在跑的运行则原地暂停，等额度恢复再继续（见[时间和暂停](../runs/time.md)）。每个模型和它的凭据都列在[认证对照表](harness/README.md#authentication-matrix)里。

<a id="4-choose-what-to-run"></a>
## 4. 选择要跑什么

[`roboteam.toml`](../../roboteam.toml) 里是默认值：Codex 配模型 `sol`（gpt-6.1-sol），effort 为 `high`，`adaptive` system，全部 36 个任务，同时跑 36 个运行，每个运行 24 小时，渲染器按主机自动选择。用 `--harness claude` 又不指定模型时，选的是 `opus`（claude-opus-5-5）。

改设置有两种办法：用命令选项，或者自己写一个小 TOML 文件，只写和默认值不同的部分（这就是 *site TOML*）。本文的例子在仓库根目录下建一个 `site.toml`：

```toml
[policy]
harness = "claude"

[batch]
parallel = 1
task_wall_limit_s = 1800.0     # 30 minutes instead of 24 hours

[selection]
cases = ["transport-small-l1"]
```

`--config` 要写在命令前面。命令选项会覆盖文件里的设置；上面三项也可以不写文件，直接用选项给出：`--harness claude --parallel 1 --wall-limit 1800 --cases transport-small-l1`。

```sh
.venv/bin/roboteam --config site.toml config
.venv/bin/roboteam --config site.toml plan
.venv/bin/roboteam --config site.toml doctor
```

| 命令 | 作用 |
| --- | --- |
| `config` | 打印合并后的最终设置。有未知字段或非法值都会报错 |
| `plan` | 列出选中的任务（`jobs`）、harness、模型、system，以及运行要用的 policy environment。它不写任何文件，也不调用模型 |
| `doctor` | 启动 harness CLI 和它的沙箱，真实渲染一张图像。它不读凭据，也不调用模型。有检查没通过时退出码为 2；JSON 报告里每项检查一条，带 `passed` 字段，失败时还有 `error` |

渲染检查没通过，说明渲染器和机器不匹配。`render.device = "auto"` 在 macOS 上选 `native`，在有 NVIDIA GPU 的 Linux 上选 `nvidia`，其他情况选 `cpu`；也可以用 `--render` 或 `render.device` 手动指定。一种渲染器失败了，不会自动换成另一种。

可用的选项有 `--harness`、`--model`、`--effort`、`--system`、`--tools`、`--observation`、`--task-types`、`--level`、`--min-arms`、`--cases`、`--parallel`、`--wall-limit`、`--render`、`--observation-profile` 和 `--record-video`。[命令行指南](cli.md)列出了所有选项和设置；[`docs/hosts/examples/`](../hosts/examples) 里有 Mac、Linux 主机和 Slurm 的 site TOML 模板，可以拿来起步。

<a id="5-build-and-check-the-policy-environment"></a>
## 5. 构建并检查 policy environment

agent 可以自己写 Python、跑 Python。每次运行都给它们一个冻结的 Python 3.12 环境，叫 *policy environment*，从不让它们用主机的 Python。运行还会冻结一张*访问表*：agent 的文件工具和 shell 能读写哪些目录。checkout、用户主目录和其他运行都不对它们开放。

每台主机构建一次环境，放在用户主目录、仓库和 `/tmp` 之外的目录里。构建需要联网。然后检查它的沙箱在这台主机上是否守得住：

```sh
# macOS
.venv/bin/python -m scripts.release.build_policy_env --base /Users/Shared/roboteam
.venv/bin/python -m scripts.release.check_policy_env /Users/Shared/roboteam/policy-env-<id> \
  --harness claude
```

```sh
# Linux
export ROBOTEAM_POLICY_ENV_BASE=/var/lib/roboteam/env    # any folder you can write, see below
.venv/bin/python -m scripts.release.build_policy_env --base $ROBOTEAM_POLICY_ENV_BASE
.venv/bin/python -m scripts.release.check_policy_env $ROBOTEAM_POLICY_ENV_BASE/policy-env-<id> \
  --harness claude
```

第一条命令会打印构建出的目录（`root`），把它传给第二条命令。检查会启动真实的 CLI，连一个本地的假模型，不调用真模型，然后逐一试大约 50 件事：有些 agent 必须做得到，有些必须做不到。通过后会在构建目录旁写一条记录。不带 `--harness` 时两种 harness 都检查，所以两个 CLI 都得装好。改了 CLI 版本后要重新检查。

在 macOS 上，`prepare` 默认用 `/Users/Shared/roboteam` 下的构建。在 Linux 上，要自己选一个基础目录（比如 `/var/tmp` 下，或某个数据卷上），并在准备运行的 shell 里把 `ROBOTEAM_POLICY_ENV_BASE` 设成它；不设的话 `prepare` 会拒绝执行。Linux 上还要把 batch 和 `TMPDIR` 都放在 `/tmp` 之外。检查会打印它找到的隔离方式：bubblewrap 能创建 user namespace 的机器上是 `claude-sandbox`，不能创建的是 `landlock-v1`（Ubuntu 24.04 默认禁止创建）。两种都支持。各平台的细节和已知限制见 [policy environment](../hosts/policy-environment.md)。

<a id="6-preflight-then-run"></a>
## 6. 先 preflight，再运行

```sh
.venv/bin/roboteam --config site.toml preflight --confirm-spend --max-budget-usd 1
.venv/bin/roboteam --config site.toml prepare --output runs/batches/first-run
.venv/bin/roboteam run runs/batches/first-run
.venv/bin/roboteam status runs/batches/first-run
```

**`preflight`** 会花一点钱调用几次模型，确认模型能配合 harness 处理图像、工具、session 和 fork，然后写一份*回执*（receipt）：`runs/receipts/` 下的一个文件，记下模型、CLI 版本和检查结果。batch 没有相匹配且已通过的回执，`run` 就拒绝运行它，所以换了模型、effort 或 CLI 后要重跑 `preflight`。不带 `--confirm-spend` 时它不调用模型，结果也不算通过。用 Claude Code 时必须给 `--max-budget-usd`，它按 CLI 报告的花费给每项检查设上限。

**`prepare`** 写出 batch 目录，并为每个运行冻结任务、场景、规则和提示词、源代码、最终设置、policy environment，以及这些东西的哈希。它不调用模型，也不启动仿真世界。`--output` 必须是一个新目录。之后再改 TOML 或代码，都不会影响已经准备好的 batch；要改就重新准备一个。

**`run`** 加载 `.env`，检查冻结的设置、每个运行的输入哈希、锁定的版本和回执，然后启动运行。在 macOS 上，它把 batch 交给 launchd 就返回，关掉终端 batch 也照样跑；加 `--foreground` 则留在当前进程里跑。在 Linux 上，加 `--durable` 会作为后台服务运行；不加就在当前 shell 里跑。

**`status`** 打印 supervisor 最近一次的快照：每个运行的状态；在 macOS 上或用了 `--durable` 时，还有服务的状态。

每个运行有自己的 START。从 START 起累计有效时间，本例的时间上限是 30 分钟（默认 24 小时）。到了时间上限就打分；agent 提前调用 `finish` 且声明被接受时，提前打分。主机休眠、断网和用量额度用完都不算有效时间；断网或额度用完时，运行原地暂停，之后自己恢复（见[时间和暂停](../runs/time.md)）。

要提前结束一个 batch：

```sh
.venv/bin/roboteam stop runs/batches/first-run
```

`stop` 通知每个运行按顺序停下，之后用 `status` 确认。

运行意外停下时（它的 host、仿真世界或模型 session 结束了，而此前既没有 finish，也没到时间上限，也没有人执行 stop），会自动续跑一次，仍算同一个 trial。再停下的话，就要手动续跑（见[续跑停下的运行](../runs/continuation.md)）：

```sh
.venv/bin/roboteam continue runs/batches/first-run
```

<a id="7-read-the-results"></a>
## 7. 查看结果

```text
runs/batches/first-run/
  batch.json  effective-config.json  control/  models/
  opus/transport-small-l1/          one run: <model>/<case>/
    public/                         what the agents read: inputs, observations, delegate results
    workspace/                      the agents' only writable folder (skills.md and their own files)
    private/inputs/                 the frozen task, scene, source and settings
    private/outputs/                evaluation.json (the score), seal.json, events.jsonl, motion/
    private/state/  private/logs/  private/harness/    database, logs, harness sessions
```

分数在 `private/outputs/evaluation.json` 里：`task_success` 表示任务是否完成，`final_observation` 列出到达时间上限时拍下的图像。`seal.json` 是运行的收尾记录，说明仿真世界已经关闭，以及有没有动作没处理完。每个文件的含义，以及怎么给停下的运行生成按角色统计的报告（`report.json`），见[运行目录](../runs/run-folder.md)。

所有运行都停下后，batch 会把 evidence 收集到 `runs/exports/<batch>-<hash>/`，并在旁边写一个校验过的 ZIP。原始文件保留不动。也可以手动执行：

```sh
.venv/bin/roboteam collect runs/batches/first-run --output runs/exports/first-run
.venv/bin/roboteam archive runs/exports/first-run --output runs/exports/first-run.zip
```

运行期间或结束后，都可以在浏览器里查看 batch：

```sh
.venv/bin/python -m scripts.dev.view_batch runs/batches/first-run
```

`runs/` 下的东西都不进 Git，要另外备份（见 [evidence 存储](../runs/evidence-storage.md)）。运行、回执和导出文件都放在 `paths.runs_root` 下，默认是 `<repo>/runs`；设置 `ROBOTEAM_RUNS_ROOT` 可以覆盖它。

<a id="next"></a>
## 下一步

- 完整实验：把 `site.toml` 里那三项设置删掉，就会跑全部 36 个任务，每个 24 小时。开始前先读所用平台的指南：[Mac](hosts/mac.md)、[Linux](hosts/linux.md)、[Slurm](hosts/slurm.md)、[Docker](hosts/docker.md)。
- Harness：[总览](harness/README.md)、[Codex](../harness/codex.md)、[Claude Code](../harness/claude-code.md)。
- 一次运行是怎么回事：[任务](tasks/README.md)、[运行规则](benchmark/rules.md)、[物理和机械臂限制](../benchmark/physics.md)、[架构](../development/architecture.md)。

论文里的各种实验条件，对应下面这些设置：

| 条件 | 选项 |
| --- | --- |
| Agent system | `--system adaptive`、`single-agent`、`hierarchical` 或 `decentralized`（[各自是什么](../development/architecture.md)） |
| Harness 和模型 | `--harness codex` 或 `claude`，`--model` 取 [`models.json`](../../models.json) 里的一个条目 |
| 只用 robot tool | `--tools robot_only`（[只用 robot tool 的运行](../benchmark/robot-tool-only.md)） |
| 低分辨率 | `--observation-profile jpeg_128x80_q95` |
| Oracle | `--harness codex --model sol --system single-agent --observation ground_truth`（[ground-truth 观测](benchmark/rules.md#ground-truth-observation)） |

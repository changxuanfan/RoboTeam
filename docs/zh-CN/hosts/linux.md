[English](../../hosts/linux.md) | 简体中文
> 本文译自英文版（commit a5ff61d7），内容以英文版为准。

<a id="running-on-linux"></a>
# 在 Linux 上运行

没有 Slurm 的 Linux 工作站、服务器或云容器（比如 RunPod 的 pod），用 `run --durable` 起一个后台服务来跑 batch。[`docs/hosts/examples/linux.toml`](../../hosts/examples/linux.toml) 是一份起步用的 site TOML（4 次 Level 3 运行，Codex 订阅，CPU 渲染）：把它复制成一个不进版本库的文件（这里叫 `site.toml`），再按需修改。下面的命令把数据放在 `/workspace` 下，这是 RunPod pod 的持久卷。换成别的持久目录也行，但不要放在 home 目录和 `/tmp` 里。

<a id="1-prerequisites"></a>
## 1. 准备条件

- 持久存储，以及访问 GitHub、PyPI、npm 和模型 API 的出站网络。
- 一个沙箱，用来限制 agent 的 shell。主机上非特权 user namespace 可用时，装上 `bwrap` 和 `socat`，Claude Code 就能用它自带的 bubblewrap 沙箱。否则（大多数云容器禁用 user namespace），主机要有 Linux 6.7 或更新的内核（Landlock ABI 4）和 `libseccomp`，运行改用本项目的 `landlock-v1` 沙箱。Linux 上的 Codex 一律用 `landlock-v1`。
- Python 3.12、[uv](https://docs.astral.sh/uv/)（带 `uvx`）、Node.js、`ffmpeg`，以及锁定版本的 harness CLI（见 `roboteam/runtime/run/versions.py`：Claude Code 2.1.316，Codex 0.165.0）。harness 是包住模型的 coding-agent 程序。
- 凡是用来准备、运行或检查的 shell，`PATH` 里都要有 Node.js 和 CLI 的目录。

<a id="2-install"></a>
## 2. 安装

```sh
cd /workspace
git clone https://github.com/changxuanfan/RoboTeam.git
cd RoboTeam
uv sync --locked
.venv/bin/roboteam bootstrap
```

<a id="3-credentials"></a>
## 3. 凭据

```sh
cp .env.example .env && chmod 600 .env
```

只填你的模型用的那个变量（`CLAUDE_CODE_OAUTH_TOKEN`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等，见 `models.json`）。Codex 订阅模型要先用 `CODEX_HOME=~/.roboteam/codex-home codex login` 登录一次（示例里设了 `runtime.codex_home_scope = "shared"`）。凭据放在 `.env` 里，不要 export：运行会自己读 `.env`，后台服务启动时不带任何凭据。

<a id="4-site-settings"></a>
## 4. Site 设置

示例里已经设了下面这些，在你的 `site.toml` 里保留：

```toml
[render]
device = "cpu"                       # Mesa's software renderer; "nvidia" with an NVIDIA GPU

[paths]
runs_root = "/workspace/roboteam-runs"   # runs, receipts and exports on persistent storage
```

不设 `render.device` 时，主机有 NVIDIA GPU 就默认用 `nvidia`，没有就用 `cpu`。CPU 渲染每次运行占两个线程。

<a id="5-policy-environment"></a>
## 5. Policy environment

在主机上构建，不要放在 `/tmp` 和 checkout 里。凡是用来准备运行的 shell，都要指明 base 目录：

```sh
export ROBOTEAM_POLICY_ENV_BASE=/workspace/roboteam-env
.venv/bin/python -m scripts.release.build_policy_env --base $ROBOTEAM_POLICY_ENV_BASE   # prints its root
.venv/bin/python -m scripts.release.check_policy_env $ROBOTEAM_POLICY_ENV_BASE/policy-env-<id> \
  --scratch /workspace/roboteam-runs
```

没有检查通过的构建，`prepare` 会拒绝执行。只装了一个 CLI 时，检查命令要加上 `--harness claude` 或 `--harness codex`。详见 [policy environment](../../hosts/policy-environment.md)。

<a id="6-local-check-and-preflight"></a>
## 6. 本地检查和 preflight

```sh
.venv/bin/roboteam --config site.toml doctor
.venv/bin/roboteam --config site.toml preflight --confirm-spend
```

用 Claude Code 时，加上 `--max-budget-usd 1`。

回执写到 `<runs root>/receipts/` 下；没有对得上的回执，`run` 会拒绝这个 batch。

<a id="7-prepare-and-run"></a>
## 7. 准备和运行

```sh
B=/workspace/roboteam-runs/batches/my-batch
.venv/bin/roboteam --config site.toml prepare --output $B
.venv/bin/roboteam run $B --durable
.venv/bin/roboteam status $B          # includes "durable": the service record and whether it runs
.venv/bin/roboteam stop $B            # an orderly stop
.venv/bin/roboteam continue $B --durable   # continue stopped runs by hand, in the background
```

有 systemd 用户管理器时，`--durable` 会起一个临时的用户服务（transient user service）。没有的话（大多数容器都没有），它在独立会话里起一个 `setsid` 守护进程（见 `roboteam/launch/local/linux.py`）。`<batch>/control/durable/` 里放着 `service.json`、`stdout.log` 和 `stderr.log`；同一个 batch 不能重复提交。不加 `--durable` 时，`run` 和 `continue` 在当前 shell 里跑，shell 一退出，它们也跟着结束。

每次运行从 START 起有 24 小时的有效时间，到 24 小时上限或团队完成时评分。意外停下的运行会自动续跑一次；断网和用量额度用完时，运行会原地暂停（[时间和暂停](../../runs/time.md)、[续跑停下的运行](../../runs/continuation.md)）。

<a id="8-results"></a>
## 8. 结果

运行数据留在 batch 目录下。batch 结束时，它会收集到 `<runs root>/exports/<batch>-<hash>/`，旁边还有一个校验过的 ZIP（[evidence 的存放](../../runs/evidence-storage.md)）。

<a id="limits"></a>
## 限制

- **policy 脚本里不能用进程池。** 没有 user namespace，任何命令都拿不到私有的 `/dev/shm`，所以 `/dev/shm` 一直是关着的：`multiprocessing.Pool` 和 `ProcessPoolExecutor` 会失败，线程和普通子进程可以用。
- **其他进程看得见。** Landlock 没法对 policy shell 隐藏别的进程，但 policy shell 读不到这些进程的环境变量，也不能 trace 它们或给它们发信号。
- **访问表关闭了整个 `/workspace`**；在 `/workspace` 下，agent 只能碰到本次运行自己的 `public/`、`workspace/` 和 policy environment（[agent 能碰到什么](../../hosts/policy-environment.md#what-a-policy-can-reach)）。

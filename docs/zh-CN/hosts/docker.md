[English](../../hosts/docker.md) | 简体中文
> 本文译自英文版（commit a5ff61d7），内容以英文版为准。

<a id="running-in-docker"></a>
# 在 Docker 里运行

`roboteam container ...` 在镜像里跑统一的 CLI。镜像用已提交的源码构建，另配三个持久的本地 Docker 卷，分别放运行数据、harness 状态和 policy environment（给 agent 用的 Python 环境）。harness 是包住模型的 coding-agent 程序。拷回主机的只有一样东西：运行停下后校验过的 evidence ZIP。

每个 workspace 都要用 `container policy-env` 构建并检查一次 policy environment（第 5 步）；检查通过之前，`container prepare` 会拒绝执行。

<a id="1-prerequisites"></a>
## 1. 准备条件

- macOS 上装 Docker Desktop，Linux 上装 Docker Engine。macOS 上的容器其实是 Docker 虚拟机里的 Linux：只能用 CPU 渲染，没有 Metal。
- 要用 NVIDIA 渲染：Linux 主机、NVIDIA GPU、主机驱动和 NVIDIA container runtime。
- 主机上一个用 `uv sync --locked` 装好的 checkout，已跟踪的文件不能有未提交的改动（构建用的是 `git archive HEAD`）。

<a id="2-build"></a>
## 2. 构建

```sh
.venv/bin/roboteam container build
```

镜像（[`docker/Dockerfile`](../../../docker/Dockerfile)）基于 `python:3.12-slim-bookworm`，装了 Node.js 22、Codex 0.165.0、Claude Code 2.1.316、OSMesa、EGL 和 `ffmpeg`。构建时会跑 `uv sync --locked` 和 `roboteam bootstrap`，所以锁定的资源文件都在镜像里。镜像的 tag 是 `roboteam:<commit[:12]>`（或 `container.image`），label 里记着 commit；已有的镜像如果来自别的 commit，一律拒绝使用。`.env`、登录信息和运行数据从不进镜像。镜像里没有 `bwrap` 和 `socat`，所以两种 harness 都用本项目的 `landlock-v1` 沙箱（Landlock 加 seccomp）来限制 agent 的 shell。

查看任何子命令的帮助都不用装 Docker：`roboteam container prepare --help`。

<a id="3-site-toml"></a>
## 3. Site TOML

```toml
# docker.toml
[render]
device = "cpu"                       # "nvidia" on a Linux GPU host

[container]
workspace = "default"                # names the three volumes
memory_gib = 0                       # 0: no limit beyond Docker's
cpus = 0.0
seccomp_profile = "default"          # "unconfined" removes Docker's seccomp filter (see Limits)
```

`--config` 要写在 `container` 前面（`roboteam --config docker.toml container ...`）；写在 `container` 后面，命令会拒绝执行。Docker Desktop 虚拟机的内存是硬上限，而 wrapper 从不调低 `batch.parallel`。

<a id="4-credentials"></a>
## 4. 凭据

把模型要用的变量写进主机的 `.env`（或者 shell 里）。wrapper 只按变量名转发所选模型的 `env_key` 和 `base_url_env`；变量的值从不出现在 Docker 参数、镜像层、TOML 或 evidence 里。

```sh
.venv/bin/roboteam container auth claude setup-token          # prints a token: store it as CLAUDE_CODE_OAUTH_TOKEN in .env
.venv/bin/roboteam --config docker.toml container auth codex login --device-auth
```

Codex 的登录信息以文件形式存在状态卷的 `/opt/RoboTeam/.roboteam/subscription` 里，设了 `runtime.codex_home_scope = "shared"` 的 Codex 订阅模型会用它。主机的 `~/.codex`、`~/.claude` 和钥匙串从不挂载进容器。

<a id="5-policy-environment-check-and-preflight"></a>
## 5. Policy environment、检查和 preflight

```sh
.venv/bin/roboteam --config docker.toml container policy-env
.venv/bin/roboteam --config docker.toml container doctor
.venv/bin/roboteam --config docker.toml container plan
.venv/bin/roboteam --config docker.toml container preflight --confirm-spend                                       # Codex
.venv/bin/roboteam --config docker.toml container preflight --harness claude --confirm-spend --max-budget-usd 1   # Claude Code
```

`policy-env` 在自己的卷（`/opt/roboteam-policy`）里构建 policy environment，再拿两种 harness 的真实 CLI 跑一遍沙箱检查，不调用模型；之后的运行都用这个环境。如果检查报告 Landlock 不可用，说明是 Docker 的 seccomp profile 挡住了它：设 `seccomp_profile = "unconfined"`（见限制）。`doctor` 检查 CLI、沙箱和一个真实的 MuJoCo 渲染上下文，不做认证。回执写在 runs 卷里。

<a id="6-prepare-run-status-stop"></a>
## 6. 准备、运行、查看状态、停止

```sh
.venv/bin/roboteam --config docker.toml container prepare --output runs/batches/my-batch
.venv/bin/roboteam --config docker.toml container run runs/batches/my-batch
.venv/bin/roboteam --config docker.toml container status runs/batches/my-batch
.venv/bin/roboteam --config docker.toml container stop runs/batches/my-batch
```

（`container policy-env` 通过之前，`prepare` 会拒绝执行。）batch 路径是 `runs/` 下的相对路径，位于 runs 卷里。`container run` 用 batch 冻结下来的配置启动它，在前台一直等到 batch 跑完。按 Ctrl-C 会请求有序停止，最多等 180 秒，让运行封存、收集完。过了这段时间容器还在跑的话，就留着它，并报告为 `still_running_needs_review`；wrapper 从不重启它。每条命令都记录在 `.roboteam/containers/<workspace>/commands/rf-<id>.json`。

没有 `container continue`：意外停下的运行会在 batch 里自动续跑一次，但停下的运行没法通过 wrapper 手动续跑。

<a id="7-results"></a>
## 7. 结果

batch 结束并收集完以后，wrapper 拿 ZIP 的 SHA-256 和容器报告的结果比对，再把 ZIP 拷到 `runs/container-exports/<workspace>/<batch>-<hash>.zip`。同名的 ZIP 已经存在时，内容相同就保留原文件，内容不同就拒绝。

其余数据都留在卷里。卷名由 checkout 路径和 `container.workspace` 决定：

| 卷 | 挂载点 | 内容 |
| --- | --- | --- |
| `roboteam-<id>-<workspace>-runs` | `/opt/RoboTeam/runs` | batch、运动记录、回执、collection、ZIP |
| `roboteam-<id>-<workspace>-state` | `/opt/RoboTeam/.roboteam` | 每次运行的 Codex home 和会话、订阅登录信息、Claude Code 的配置 |
| `roboteam-<id>-<workspace>-policy` | `/opt/roboteam-policy` | policy environment 和它的检查回执 |

不要从卷里拷出正在使用的 SQLite 文件。删掉一个卷，里面的运行也就没了；wrapper 从不删卷。

<a id="limits"></a>
## 限制

- **不能通过 wrapper `continue`。**
- **Seccomp。** Docker 默认的 seccomp profile 可能挡住 Landlock。设 `seccomp_profile = "unconfined"` 后，`policy-env`、`doctor`、`preflight` 和 `run` 都不再用这个 profile，也不需要 `--privileged`；agent 的 shell 会自己装上 seccomp 过滤器和 Landlock 规则。
- 容器里没有 user namespace 时，`/dev/shm` 对 policy 是关着的，所以 Python 的进程池在这里会失败（[policy environment](../../hosts/policy-environment.md)）。
- **Slurm 作业不用 Docker**，而是 stage 到节点本地的 scratch 上（[Slurm](slurm.md)）。

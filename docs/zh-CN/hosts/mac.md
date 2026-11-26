[English](../../hosts/mac.md) | 简体中文
> 本文译自英文版（commit a5ff61d7），内容以英文版为准。

<a id="running-on-a-mac"></a>
# 在 Mac 上运行

在 Mac 上，batch 作为用户级 launchd 作业运行（launchd 是 macOS 的服务管理器），所以启动它的终端或 agent 会话关掉以后，batch 照样在跑。[`docs/hosts/examples/mac.toml`](../../hosts/examples/mac.toml) 是一份起步用的 site TOML：把它复制成一个不进版本库的文件（这里叫 `site.toml`），再按需修改。

<a id="1-prerequisites"></a>
## 1. 准备条件

- Apple 芯片的 macOS，笔记本不要合盖（见[限制](#limits)）。
- Python 3.12、[uv](https://docs.astral.sh/uv/)（policy environment 由它的 `uvx` 构建）、Node.js 和 `ffmpeg`。
- 锁定版本的 harness CLI，排在 `PATH` 最前面：Claude Code 2.1.316（`claude`）或 Codex 0.165.0（`codex`）。harness 是包住模型的 coding-agent 程序。锁定的版本写在 `roboteam/runtime/run/versions.py` 里，MuJoCo、NumPy 和 Pillow 的版本也在这里；版本不对，`prepare` 和 `run` 都会拒绝执行。

<a id="2-install"></a>
## 2. 安装

```sh
git clone https://github.com/changxuanfan/RoboTeam.git
cd RoboTeam
uv sync --locked
.venv/bin/roboteam bootstrap      # downloads and verifies the pinned task assets
```

<a id="3-credentials"></a>
## 3. 凭据

```sh
cp .env.example .env && chmod 600 .env
```

只填你的模型要读的那个变量（见 `models.json` 里的 `env_key`）：

| 模型 | 凭据 |
| --- | --- |
| Claude `opus`（默认）、`haiku` | `.env` 里的 `ANTHROPIC_API_KEY` |
| Claude `opus_subscription_token`、`haiku_subscription_token` | `.env` 里的 `CLAUDE_CODE_OAUTH_TOKEN`（用 `claude setup-token` 获取） |
| Codex `sol`（默认）、`luna` | `.env` 里的 `OPENAI_API_KEY` |
| Codex `sol_subscription`、`luna_subscription` | 不用填变量：用 `CODEX_HOME=~/.roboteam/codex-home codex login` 登录一次，再在 site TOML 里设 `runtime.codex_home_scope = "shared"` |

凭据放在 `.env` 里，不要在 shell 里 export。`prepare`、`run` 和 `continue` 会自己读 `.env`；launchd 的作业文件里不存任何凭据，Claude 的 token 通过管道交给 CLI。

<a id="4-policy-environment"></a>
## 4. Policy environment

每台 Mac 构建一次，再检查一遍。默认的 base 目录是 `/Users/Shared/roboteam`，所以不用设环境变量：

```sh
.venv/bin/python -m scripts.release.build_policy_env --base /Users/Shared/roboteam   # prints its root
.venv/bin/python -m scripts.release.check_policy_env /Users/Shared/roboteam/policy-env-<id>
```

检查会让装好的每个 CLI 对着一个本地桩服务跑一遍，不调用模型，然后在构建目录旁边留下一份回执。只装了一个 CLI 时，加上 `--harness claude` 或 `--harness codex`。没通过检查的构建，`prepare` 会拒绝使用。换了 CLI 版本后要重新检查。详见 [policy environment](../../hosts/policy-environment.md)。

<a id="5-local-check-and-preflight"></a>
## 5. 本地检查和 preflight

```sh
.venv/bin/roboteam --config site.toml doctor          # CLI, sandbox, renderer; exits 2 on failure
.venv/bin/roboteam --config site.toml plan            # tasks, model, policy_environment; no model calls
.venv/bin/roboteam --config site.toml preflight --confirm-spend --max-budget-usd 1
```

`preflight` 会发几次要付费的调用。`--max-budget-usd` 是给 Claude Code 用的，用 Codex 时去掉。Claude Code 要做两项检查，回执写到 `<runs root>/receipts/claude/basic/` 和 `receipts/claude/blocked-parent/` 下；Codex 的回执写到 `<runs root>/receipts/codex/compatibility/<model>/report.json`。没有和模型、CLI 版本对得上的回执，`run` 会拒绝这个 batch。

<a id="6-prepare-and-run"></a>
## 6. 准备和运行

batch 跑的时候会盯着自己的源码。只要有一个源文件改了，它就终止所有运行，而且不可恢复（`INTEGRITY_ABORT`，这样的运行不能续跑）。所以 batch 要从一个运行期间没有任何东西会改动的 checkout 里跑，比如在仓库外面建一个 `main` 的 detached worktree，再把 runs root 指到回执和结果该放的地方：

```sh
git worktree add --detach ~/Repos/RoboTeam-run main
cd ~/Repos/RoboTeam-run && uv sync --locked && install -m 600 ../RoboTeam/.env .env
export ROBOTEAM_RUNS_ROOT=~/Repos/RoboTeam/runs
```

```sh
.venv/bin/roboteam --config site.toml prepare --output runs/batches/my-batch
.venv/bin/roboteam run runs/batches/my-batch          # submits the launchd job and returns
.venv/bin/roboteam status runs/batches/my-batch       # includes the job's state under "durable"
.venv/bin/roboteam stop runs/batches/my-batch         # an orderly stop
.venv/bin/roboteam continue runs/batches/my-batch     # continue stopped runs by hand
```

`run` 和 `continue` 读的是 batch 冻结下来的配置，不看 `--config`。`run --foreground` 直接在当前进程里跑，不经过 launchd。不是刚准备好的 batch，`run` 一律拒绝；supervisor 死掉的 batch，用 `run --continue` 接着跑。每次运行从 START 起有 24 小时的有效时间，到 24 小时上限或团队完成时评分。意外停下的运行会自动续跑一次，见[续跑停下的运行](../../runs/continuation.md)。

这个 launchd 作业：

- 设了 `ProcessType=Interactive`，macOS 会像调度前台应用一样调度它；
- 在 `caffeinate -ims` 下运行，作业活着的时候 Mac 不会睡眠；
- 把 `service.plist`、`metadata.json`、`stdout.log` 和 `stderr.log` 写到 `<batch>/control/durable/`（续跑写到 `control/durable/continue-<n>/`）。

断网或用量额度用完时，运行会原地暂停，之后自己恢复（[时间和暂停](../../runs/time.md)）。

<a id="7-results"></a>
## 7. 结果

每次运行的结果、录像和 evidence 都留在 batch 下它自己的目录里。batch 结束时，`run` 把它收集到 `<runs root>/exports/<batch>-<hash>/`，并在旁边归档一个校验过的 ZIP。runs root 取 `paths.runs_root` 或 `ROBOTEAM_RUNS_ROOT`（默认是 `<repo>/runs`）。见 [evidence 的存放](../../runs/evidence-storage.md)。

<a id="limits"></a>
## 限制

- **合上盖子 Mac 就会睡眠**，有 `caffeinate` 也没用。要么一直开着盖子，要么接上外接显示器和电源。睡眠时间不算有效时间，但这段时间里运行也没有任何进展。
- **锁屏。** 仿真世界通过一个隐藏窗口渲染。锁屏期间窗口服务可能不响应，这时新启动的仿真世界会一直等着；已经在跑的照常运行。
- **在 macOS 上，`ProcessPoolExecutor` 在 Claude Code 的沙箱里会失败**；`multiprocessing.Pool` 可以用（[policy environment](../../hosts/policy-environment.md#known-limits)）。
- 在 macOS 上，`render.device` 解析为 `native`。

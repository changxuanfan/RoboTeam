[English](../cli.md) | 简体中文
> 本文译自英文版（commit 6d30f7c3），内容以英文版为准。

<a id="command-line-and-settings"></a>
# 命令行和设置

`roboteam` 命令负责规划、准备、检查、启动和收集 batch，两种 harness 都适用。在仓库根目录下用 `.venv/bin/roboteam` 调用。第一次运行的完整步骤见[上手指南](getting-started.md)；本文是参考手册。

<a id="commands"></a>
## 命令

有三个全局选项，写在命令前面：`--config FILE`（覆盖部分默认值的 site TOML）、`--runs-root DIR`（batch、回执、导出文件和缓存的存放位置，对应设置 `paths.runs_root`）、`--result-file FILE`（另把命令结果以 JSON 写进一个文件）。

| 命令 | 作用 | 是否调用模型 |
| --- | --- | --- |
| `config` | 打印合并后的最终设置 | 否 |
| `plan` | 列出选中的任务、模型和 policy environment | 否 |
| `doctor` | 在本机检查 harness CLI、它的沙箱和渲染器 | 否 |
| `bootstrap` | 下载并校验锁定的资源 | 否 |
| `preflight [--confirm-spend] [--smoke-only] [--max-budget-usd N]` | 确认模型能配合 harness 工作，并写下回执 | 带 `--confirm-spend` 时调用 |
| `prepare --output DIR` | 把一个新 batch 冻结到 `DIR`，不启动仿真世界 | 否 |
| `run BATCH [--durable] [--foreground] [--continue]` | 运行准备好的 batch | 是 |
| `continue BATCH [--cases ...] [--durable] [--foreground]` | 手动续跑停下的运行，仍算原来的 trial | 是 |
| `status BATCH` | 打印 supervisor 最近一次的状态快照 | 否 |
| `stop BATCH` | 通知 batch 里的每个运行按顺序停下 | 否 |
| `collect BATCH --output DIR` | batch 停下后，把它的 evidence 复制成一份 collection | 否 |
| `archive COLLECTION --output ZIP` | 把 collection 打包成校验过的 ZIP | 否 |
| `extract ZIP --output DIR` | 校验并解开 evidence ZIP | 否 |
| `slurm-submit --output DIR [--queue]` | 冻结一份 Slurm 提交；加 `--queue` 时直接排进队列（[Slurm](hosts/slurm.md)） | 否 |
| `container ...` | 在 Docker 里执行同样的命令（[Docker](hosts/docker.md)） | 看具体命令 |

`config`、`plan`、`doctor`、`preflight`、`prepare` 和 `slurm-submit` 接受下面这些选项。每个选项对应 `roboteam.toml` 里的一项设置，只对本次命令生效：

| 选项 | 取值 | 设置 |
| --- | --- | --- |
| `--harness` | `codex`、`claude` | `policy.harness` |
| `--model` | `models.json` 里该 harness 一节中的一个条目 | `policy.model` |
| `--effort` | `minimal`、`low`、`medium`、`high`、`xhigh`、`max` | `policy.effort` |
| `--system` | `adaptive`、`single-agent`、`hierarchical`、`decentralized` | `policy.system` |
| `--tools` | `full`、`robot_only` | `policy.tools` |
| `--observation` | `images`、`ground_truth` | `policy.observation` |
| `--task-types` | `transport`、`mosaic`、`relay`、`dial` 中的一个或多个 | `selection.task_types` |
| `--level` | `1`、`2`、`3` | `selection.level` |
| `--min-arms` | 开关：每种选中的任务类型只保留机械臂最少的 case | `selection.min_arms` |
| `--cases` | 一个或多个任务 id，例如 `transport-small-l1` | `selection.cases` |
| `--parallel` | 1 到 36 | `batch.parallel` |
| `--wall-limit` | 每个运行的有效时间，单位秒，最多 86400 | `batch.task_wall_limit_s` |
| `--render` | `nvidia`、`cpu`、`native` | `render.device` |
| `--observation-profile` | `jpeg_1280x800_q90`、`jpeg_128x80_q95` | `render.observation_profile` |
| `--record-video` | 开关：给每个运行录一段 MP4 | `render.record_realtime_video` |

其余设置（启动时序、Codex home、evidence 收集、Slurm 和 Docker）只能在 site TOML 里设。

```sh
.venv/bin/roboteam config
.venv/bin/roboteam plan --level 1 --min-arms --parallel 4
.venv/bin/roboteam plan --harness claude --task-types relay --level 1
.venv/bin/roboteam --config docs/hosts/examples/mac.toml plan
```

<a id="defaults-and-precedence"></a>
## 默认值和优先级

默认值在 `roboteam.toml` 里。site TOML（`--config`）覆盖它写到的设置，命令选项又覆盖这两者。未知字段、类型不对和非法值都会报错。`schema_version` 是 11，也是唯一能读的版本；site TOML 里可以不写。凭据放在 `.env` 或环境变量里，绝不写进 TOML 文件。

默认计划选中全部 36 个任务，用 Codex 和模型 `sol`（gpt-6.1-sol），effort 为 `high`，`adaptive` system，同时跑 36 个运行，每个运行 24 小时有效时间。用 `--harness claude` 又不指定模型时，选的是 `opus`（claude-opus-5-5）。

| 设置 | 含义 |
| --- | --- |
| `policy.harness` | `codex` 或 `claude` |
| `policy.model` | `models.json` 里该 harness 一节中的一个条目。默认：Codex 用 `sol`，Claude Code 用 `opus` |
| `policy.effort` | 向模型请求的推理强度；必须和 preflight 回执里的一致 |
| `policy.system` | `adaptive`、`single-agent`、`hierarchical` 或 `decentralized` |
| `policy.tools` | `full`（默认）或 `robot_only`：只给 robot tool（[只用 robot tool 的运行](../benchmark/robot-tool-only.md)） |
| `policy.observation` | `images`（默认）或 `ground_truth`：不给相机图像，改给仿真器的状态（[ground-truth 观测](benchmark/rules.md#ground-truth-observation)） |
| `batch.parallel` | 同时跑几个运行，1 到 36 |
| `batch.startup_interval_s` | 相邻两个运行的启动间隔（0.3 s） |
| `batch.task_wall_limit_s` | 每个运行的有效时间，86400 s（[怎么计时](../runs/time.md)）；86400 也是一个运行最多能拿到的时间 |
| `batch.startup_timeout_s` | 运行的仿真世界准备就绪最多可用多长时间（600 s） |
| `selection.task_types`、`selection.cases` | 在发布的任务里筛选；留空表示全选 |
| `selection.level` | 0 表示所有难度，否则为 1、2 或 3 |
| `selection.min_arms` | 先按难度筛选，再在每种选中的任务类型里只保留机械臂最少的 case。选中所有难度时会剩下 10 个 case，因为 Dial 只有 Level 1 是 4 条机械臂 |
| `render.device` | `auto`（默认）、`nvidia`（Linux EGL）、`cpu`（Linux OSMesa）或 `native`（macOS）。`auto` 在 macOS 上选 `native`，在有 NVIDIA GPU 的 Linux 上选 `nvidia`，否则选 `cpu` |
| `render.observation_profile` | `jpeg_1280x800_q90`（默认）或低分辨率条件用的 `jpeg_128x80_q95`（[观测图像](benchmark/rules.md#observation-images)） |
| `render.record_realtime_video` | 运行时给每个运行录一段 MP4；默认关闭；需要 `ffmpeg` |
| `runtime.codex_tool_backend` | `auto`（默认）、`native` 或 `landlock-v1`。`auto` 在 macOS 上选 `native`，在 Linux 上选 `landlock-v1`（[Codex 的隔离](../harness/codex.md#isolation)）。只对 Codex 有效 |
| `runtime.codex_home_scope` | Codex 把 session 和登录状态放在哪里：`task`（每个运行一个 home，默认）、`shared`（共用一个登录了 ChatGPT 的 home）或 `job`（Slurm 上的订阅作业） |
| `runtime.codex_home` | home 的目录；留空则自动选一个；必须在 batch 之外 |
| `evidence.auto_collect`、`evidence.auto_archive` | batch 结束时收集 evidence，再生成校验过的 ZIP；两项默认都打开 |
| `evidence.delete_sources` | 必须保持 `false` |
| `slurm.*` | Slurm 作业的资源分配、认证和网络路径（[Slurm](hosts/slurm.md)） |
| `container.workspace`、`container.image`、`container.memory_gib`、`container.cpus` | Docker 的卷、镜像标签和资源限制（0 表示不加限制） |
| `container.seccomp_profile` | `default`；如果 Docker 的 seccomp 过滤器挡住了沙箱，就用 `unconfined`（[Docker](hosts/docker.md#limits)） |
| `paths.runs_root` | 运行、回执和导出文件的存放位置；留空即 `<repo>/runs`；`--runs-root` 或 `ROBOTEAM_RUNS_ROOT` 可以覆盖它 |

<a id="settings-files"></a>
## 设置文件

新运行的设置来自下面这些文件。`prepare` 把合并结果冻结进每个新 batch；之后再改文件，已经准备好的 batch 也不会变。

| 路径 | 是什么 |
| --- | --- |
| `roboteam.toml` | 新运行的默认值 |
| `models.json` | 所有可选的模型，每种 harness 一节（`harnesses.codex`、`harnesses.claude`）。运行会冻结它所用 harness 的那一节 |
| `roboteam/runtime/run/defaults.json` | 运行时程序在一次运行里遵循的规则：动作超时、检查间隔、消息上限、工作区，以及动作轨迹和视频的采样率。这些属于 benchmark 本身，不是可调的设置：在这个文件的基础上，`roboteam.toml` 和命令选项只能设定 harness、模型、effort、system、工具、观测方式、图像规格、渲染器、录像和启动超时。改过这个文件后跑出的结果，和论文里的不可比（[固定规则](benchmark/rules.md#fixed-runtime-rules)） |
| `roboteam/runtime/sandbox/policy-env/` | [policy environment](../hosts/policy-environment.md) 的包清单和锁文件 |
| `roboteam/harness/adapters/*/requirements.txt` | 两个[适配器](harness/README.md#guides)的可选依赖 |
| `benchmark/assets.json` | 锁定的资源压缩包，由 `roboteam bootstrap` 还原 |
| `docs/hosts/examples/mac.toml`、`linux.toml`、`slurm.toml` | 各平台的 site TOML 模板；复制成一个不受 Git 跟踪的文件再改 |

选了一个模型名，不等于这个模型就能配合 harness 工作：运行还需要该模型一份已通过的 preflight 回执。

<a id="renderers"></a>
## 渲染器

`nvidia` 创建无界面的 EGL 上下文。`cpu` 通过 OSMesa 使用 Mesa 的软件渲染器。`native` 使用 macOS 的 OpenGL。选了不属于当前操作系统的渲染器会报错，一种渲染器也不会自动换成另一种。无论用哪种渲染器，物理都在 CPU 上算。`uv sync` 不会安装任何显卡驱动或系统 OpenGL 库。

<a id="preflight"></a>
## Preflight

```sh
.venv/bin/roboteam preflight --confirm-spend                 # Codex, full check
.venv/bin/roboteam preflight --confirm-spend --smoke-only    # Codex, smaller check; does not admit a run
.venv/bin/roboteam preflight --harness claude --max-budget-usd 1 --confirm-spend
```

不带 `--confirm-spend` 时不调用模型，结果是 `not_run`。回执放在 `<runs root>/receipts/` 下。batch 的模型、模型目录或 CLI 版本和已通过的回执对不上，`run` 就拒绝运行这个 batch。详情见 [Codex](../harness/codex.md#preflight-and-receipts) 和 [Claude Code](../harness/claude-code.md#preflight-and-receipts)。

<a id="run-watch-and-stop"></a>
## 运行、查看和停止

```sh
.venv/bin/roboteam run runs/batches/my-batch
.venv/bin/roboteam status runs/batches/my-batch
.venv/bin/roboteam stop runs/batches/my-batch
.venv/bin/roboteam continue runs/batches/my-batch --cases transport-small-l1
```

`run` 读的是 batch 冻结下来的 `effective-config.json`，不读 `--config`。想改任何东西，都要重新准备一个 batch。

| 平台 | `run` 和 `continue` |
| --- | --- |
| macOS | 把 batch 作为用户级 launchd 作业、在 `caffeinate` 下提交，然后返回。关掉终端作业也照样跑。加 `--foreground` 则在当前进程里跑 |
| Linux | 在当前 shell 里跑。加 `--durable` 则启动后台服务：有用户级 systemd 时用 systemd 用户服务，没有时用 `setsid` 守护进程 |

后台服务会一直用它启动时的那份源代码。正在跑的运行要放在没人改动的 checkout 上，开发在另一个 worktree 里做（[Mac](hosts/mac.md#6-prepare-and-run)）。

`run --continue` 接管 supervisor 意外退出的 batch。`continue` 手动续跑停下的运行，finish 或到达时间上限之后也可以续跑（分数不变）。意外停下的运行本来就会自动续跑一次（[续跑停下的运行](../runs/continuation.md)）。

`status` 读的是 supervisor 写下的 JSON 快照，从不打开正在使用的数据库。`stop` 写下停止标记，之后要看 `status` 和每个运行的 `seal.json` 确认。

运行还在跑时，它的数据库要放在本地存储上，绝不能放在 Lustre 或 NFS 上；也绝不要从主机上打开 Docker 里某个运行的数据库。

<a id="evidence-and-zip-output"></a>
## Evidence 和 ZIP 输出

batch 里所有运行都停下后，`run` 会把 batch 收集到 `<runs root>/exports/<batch>-<hash>/`，并在旁边写一个校验过的 ZIP `<batch>-<hash>.zip`。也可以手动执行：

```sh
.venv/bin/roboteam collect runs/batches/my-batch --output runs/exports/my-batch
.venv/bin/roboteam archive runs/exports/my-batch --output runs/exports/my-batch.zip
.venv/bin/roboteam extract runs/exports/my-batch.zip --output runs/restored/my-batch-objects
.venv/bin/python -m roboteam.launch.results.archive_batch restore runs/restored/my-batch-objects \
  --output runs/restored/my-batch
```

`extract` 校验 ZIP，解开其中压缩过的对象。`restore` 再用这些对象重建原始文件，并逐个核对哈希。整个过程不删除任何东西：batch 和 collection 会一直保留，直到你自己删掉。另见 [evidence 存储](../runs/evidence-storage.md)。

[English](../README.md) | 简体中文
> 本文译自英文版（commit cabcac8d），内容以英文版为准。

<a id="documentation"></a>
# 文档

先看[上手指南](getting-started.md)：从刚克隆的仓库讲起，一直讲到跑完一次运行。[命令行指南](cli.md)列出了所有命令和设置。

| 主题 | 指南 |
| --- | --- |
| 入门 | [上手指南](getting-started.md)、[命令行和设置](cli.md) |
| 任务 | [四种任务类型](tasks/README.md)：[Transport](tasks/transport.md)、[Relay](tasks/relay.md)、[Mosaic](tasks/mosaic.md)、[Dial](tasks/dial.md)。发布的 36 个任务在 [`benchmark/`](../../benchmark/README.md) 里，[项目网页](https://changxuanfan.github.io/RoboTeam/zh/)上可以看到每一个 |
| 运行规则 | [规则](benchmark/rules.md)、[物理和机械臂限制](../benchmark/physics.md)、[只用 robot tool 的运行](../benchmark/robot-tool-only.md) |
| Harness | [总览和模型](harness/README.md)、[Codex](../harness/codex.md)、[Claude Code](../harness/claude-code.md) |
| 可选的适配器 | [在 Codex 里用 Claude](../harness/claude-in-codex.md)、[在 Claude Code 里用 GPT](../harness/gpt-in-claude-code.md)、[在 Slurm 上共用一个 Codex 登录](../harness/shared-login.md) |
| 主机 | [Mac](hosts/mac.md)、[Linux](hosts/linux.md)、[Slurm](hosts/slurm.md)、[Docker](hosts/docker.md)、[policy environment](../hosts/policy-environment.md)、[site TOML 示例](../hosts/examples) |
| 运行 | [运行目录](../runs/run-folder.md)（一次运行的每个文件）、[时间和暂停](../runs/time.md)、[续跑停下的运行](../runs/continuation.md)、[任务恢复](../runs/recovery.md)、[evidence 存储](../runs/evidence-storage.md)、[查看已保存的运行](../runs/viewer.md) |
| 开发 | [更新日志](../changelog.md)、[架构](../development/architecture.md)、[仓库结构](development/repository-layout.md)、[测试](../development/testing.md)、[运行时检查器覆盖哪些内容](../development/test-coverage.md)、[工程脚本](../../scripts/README.md) |
| 让 agent 管理 batch | [操作手册](../runs/operator-runbook.md)，以及给 [Codex](../runs/operator-prompt-codex.md) 和 [Claude Code](../runs/operator-prompt-claude.md) 的提示词 |
| 项目网页 | [设计和素材来源](../../site/DESIGN.md) |

<a id="terms"></a>
## 术语

下面这些词在各篇指南里都只有一个意思。

<a id="what-is-run"></a>
### 跑的是什么

| 术语 | 含义 |
| --- | --- |
| 任务类型（task type） | Transport、Mosaic、Relay 或 Dial |
| 团队规模（team size） | `small`、`medium` 或 `large`，也就是一个任务有几条机械臂 |
| 难度（level） | `l1`、`l2` 或 `l3`，同一种任务类型的难易程度 |
| 任务（task、case） | 发布的任务之一，命名为 `<task type>-<team size>-l<level>`，例如 `mosaic-large-l3`。代码和文件名里叫 *case* |
| 运行（run） | 一个 agent 团队对一个任务做一次尝试，算一个 trial。运行停下后再续跑，仍是同一个 trial |
| Batch | 一个目录，放着准备好的若干个运行，这些运行一起启动、一起受监管。一个 batch 只用一种 harness、一个模型 |
| Harness | 包住模型的 coding-agent 程序，agent 就在里面跑：`codex` 或 `claude`（Claude Code） |
| 模型（model） | `models.json` 里的一个条目，例如 `sol` 或 `opus`。条目里写明服务商的模型、endpoint 和存放凭据的环境变量 |
| System | agent 的组织方式：`adaptive`、`single-agent`、`hierarchical` 或 `decentralized` |
| 工具（tools） | `full`（robot tool 加上 harness 自带的 shell 和文件工具）或 `robot_only`（只有 robot tool） |
| 观测（observation） | `images`（相机图像）或 `ground_truth`（不给图像，改给仿真器的状态） |
| 指南（guide） | agent 读的工作说明：一份协作指南，外加每种任务类型一份，放在 `prompts/guides/` 下 |

<a id="who-acts-in-a-run"></a>
### 运行里谁在干活

| 术语 | 含义 |
| --- | --- |
| Policy | 被测的那组 agent。policy 能读的内容全在运行的 `public/` 目录下 |
| 角色（role） | policy 里的一个 agent，有自己的 session：Controller、Worker 或 delegate |
| Controller | 领头的角色。在 `single-agent` 和 `adaptive` 里，它自己也控制机械臂 |
| Worker | 整次运行只控制一条机械臂的角色（`hierarchical`、`decentralized`） |
| Delegate | 临时角色。`adaptive` 的 Controller 从自己的 session fork 出它，再分给它几条机械臂 |
| Session | harness CLI 和模型之间的一段对话：Codex 里叫 thread，Claude Code 里叫 session |
| Host | 负责一次运行里所有角色的进程：启动它们的 session，把 robot tool 调用转给仿真世界，叫醒空闲的角色 |
| 仿真世界（world） | 一次运行的仿真。它的进程叫 *world owner*，负责实时推进物理仿真、渲染图像、给任务打分 |
| Robot tool | 角色观察和移动机械臂的唯一工具 |
| Meta | 运行时程序给自己的工程管理者起的名字。它只做固定的操作，比如绑定 session、送达唤醒，不做任何任务上的决定 |
| Manager | 准备、启动、停止 batch 的人、脚本或外层 agent。它不在被测范围内 |

<a id="preparing-and-checking"></a>
### 准备和检查

| 术语 | 含义 |
| --- | --- |
| Site TOML | 自己写的小 TOML 文件，用 `--config` 传入，覆盖 `roboteam.toml` 里的部分默认值 |
| 冻结（frozen） | 在 `prepare` 时复制进运行，并按哈希记录下来。之后 checkout 怎么改，运行都只用它冻结的输入、代码和设置 |
| Manifest | 运行冻结的文件清单和各自的哈希（`private/inputs/manifest.json`） |
| Policy environment | agent 自己写的代码在这个 Python 环境里运行。每台主机构建一次，和 benchmark 本身的 Python 分开 |
| 访问表（access table） | 冻结下来的目录清单，规定 agent 的文件工具和 shell 能读写哪些目录。checkout、用户主目录、其他运行和共享存储都对 agent 关闭 |
| 沙箱（sandbox） | 操作系统里执行访问表的机制：macOS 上是 Seatbelt，Linux 上是 bubblewrap，或 Landlock 加 seccomp |
| Landlock | Linux 内核的一项功能，进程可以用它限制自己的文件和网络访问。`landlock-v1` 是本项目基于它做的沙箱，用在 harness 自带沙箱跑不起来的主机上 |
| Tool backend | Codex 的 shell、patch 和图像工具怎么隔离：`native`（Codex 自带的沙箱）或 `landlock-v1` |
| Doctor | `roboteam doctor`：在本机检查 CLI、沙箱和渲染器，不调用模型 |
| Preflight | `roboteam preflight`：付费调用几次模型，确认模型能配合 harness 工作 |
| 回执（receipt） | 检查通过后写下的文件。batch 的模型和 CLI 版本找不到对应的回执，`run` 就拒绝运行这个 batch |

<a id="during-and-after-a-run"></a>
### 运行中和运行后

| 术语 | 含义 |
| --- | --- |
| START | 运行开始计时的时刻。每个运行有自己的 START |
| 有效时间（active time） | trial 真正在跑的时间。暂停、主机休眠和 segment 之间的空档都不算 |
| 时间上限（cutoff） | 一次运行的时限到头的那一刻（24 小时有效时间），仿真世界在这一刻打分 |
| 完成（finish） | 团队宣布任务做完了。声明被接受后开始打分；它本身不等于判定成功 |
| Segment | 一次运行中没有中断的一段。续跑会开始同一个 trial 的下一个 segment |
| 封存（seal） | 按顺序关闭仿真世界：不再接受新动作，拍最后的图像，然后退出。`seal.json` 记录了这一过程 |
| Egress | 运行访问模型服务商的出站网络路径 |
| 本地回环网关（loopback gateway） | `127.0.0.1` 上的一个本地进程，把一种模型 API 转换成另一种。只有两个可选的适配器会用到 |
| Evidence | 一次运行留下的全部东西：session、图像、动作轨迹、记录和分数 |
| Collection | 已停止的 batch 的 evidence 副本，带文件哈希，可以整体搬走 |
| Runs root | 运行、回执和导出文件的存放位置：`paths.runs_root`，默认是 `<repo>/runs` |

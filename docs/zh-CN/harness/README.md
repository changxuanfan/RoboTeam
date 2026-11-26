[English](../../harness/README.md) | 简体中文
> 本文译自英文版（commit bfa3d045），内容以英文版为准。

<a id="harnesses-codex-and-claude-code"></a>
# Harness：Codex 和 Claude Code

harness 就是包住模型的 coding-agent 程序，agent 在里面运行。RoboTeam 支持两种：Codex 和 Claude Code。两者跑的是同样的发布任务，冻结的输入、规则、robot tool 说明、运行时程序、START、打分和 evidence 格式也都相同。每个角色（团队里的一个 agent）就是该 harness 自己 CLI 的一个 session：Codex 里叫 thread，Claude Code 里叫 session。本页讲两种 harness 共同的部分，并列出所有模型；每种 harness 另有自己的指南。

<a id="guides"></a>
## 指南

| 指南 | 内容 |
| --- | --- |
| [Codex](../../harness/codex.md) | Codex 的安装、认证、隔离、preflight、session 和恢复 |
| [Claude Code](../../harness/claude-code.md) | Claude Code 的同样内容 |
| [模型和凭据](#providers) | 所有模型、各自的凭据，以及第三方 endpoint |
| [Claude in Codex](../../harness/claude-in-codex.md) | 可选的适配器：在 Codex harness 里运行 Claude Opus 5.5 |
| [GPT in Claude Code](../../harness/gpt-in-claude-code.md) | 可选的适配器：在 Claude Code harness 里运行 GPT-6.1 Sol |
| [在 Slurm 上共用 Codex 登录](../../harness/shared-login.md) | 第二个 Slurm batch 借用一个正在跑的作业里的 ChatGPT 登录 |
| [命令行和设置](../cli.md) | `roboteam` 的各个命令和全部设置 |
| [运行规则](../benchmark/rules.md) | START、观测图像、robot 请求、打分 |

运行从 START 起有 24 小时有效时间，到达时间上限时打分（[时间和暂停](../../runs/time.md)）。接受 `finish` 只是开始打分，并不说明成功。运行意外停下后会自动续跑一次，也可以用 `roboteam continue` 手动续跑（[续跑停下的运行](../../runs/continuation.md)）。

<a id="outer-manager-and-evaluated-policy"></a>
## 外层管理者和被测的 policy

这些命令（prepare、run、status、stop、collect）可以在 shell 里执行，也可以交给任何 coding agent 执行；不需要外层 agent，外层 session 用什么模型也不影响运行。被测的模型由冻结的 harness 和模型决定。operator 提示词（[Codex](../../runs/operator-prompt-codex.md)、[Claude Code](../../runs/operator-prompt-claude.md)）和 [operator 操作手册](../../runs/operator-runbook.md)规定了 operator 的权限：只做工程操作，绝不插手任务策略、robot 动作，也绝不改输入。operator 只要插手其中任何一样，这次运行就作废。

<a id="shared-setup"></a>
## 共同的准备工作

安装 Python 3.12、uv、Node.js，以及要用的 harness 的 CLI，版本以 `roboteam/runtime/run/versions.py` 里固定的为准（Codex 0.165.0，Claude Code 2.1.316）。版本不对，`prepare` 和 `run` 会拒绝执行。

```sh
uv sync --locked
.venv/bin/roboteam bootstrap
.venv/bin/python -m roboteam.launch.results.assets init-env
```

新的运行默认使用冻结的 [policy environment](../../hosts/policy-environment.md)。

<a id="credentials-file"></a>
### 凭据文件

`init-env` 从 `.env.example` 生成 `.env`，权限 600，Git 会忽略这个文件；已经有 `.env` 时，它拒绝覆盖（手动做法：`cp .env.example .env && chmod 600 .env`）。只填所用模型的变量，[认证矩阵](#authentication-matrix)里列出了这些变量。加载器逐行读取字面的 `KEY=value`，不执行 shell 语法；进程环境里已经设置的变量优先。凭据绝不能写进 TOML、模型目录、命令行、commit 或聊天。远程主机要有自己的 `.env`，SSH 不会转发它。

<a id="policy-assets"></a>
### policy 资源

`bootstrap` 下载 `benchmark/assets.json` 里指定的压缩包，校验它的 SHA-256，按哈希检查还原所有引用到的场景和 Panda 资源，已经正确的文件直接复用；`prepare` 在需要时也会这样做。文件不对或有冲突，校验就会失败；绝不要拿近似的资源顶替，也绝不要改预期的哈希。在不能联网的主机上，把压缩包拷过去，然后运行：

```sh
.venv/bin/python -m roboteam.launch.results.assets setup-assets --archive /path/to/archive.tar.gz
```

<a id="where-each-part-lives-in-the-code"></a>
## 各部分在代码里的位置

路径都在 `roboteam/` 下。

| 部分 | Codex | Claude Code |
| --- | --- | --- |
| 模型 | `models.json` 的 `codex` 部分 | `models.json` 的 `claude` 部分 |
| 准备 | `launch/codex_batch.py` | `launch/claude_prepare.py` |
| batch 监管 | `launch/codex_batch.py` | `launch/claude_batch.py`、`harness/claude/supervisor.py` |
| 模型的一轮 | app-server 的 `turn/start`（`harness/codex/host/policy_host.js`、`rpc.js`） | `claude -p`（`harness/claude/session/runner.py`、`session_host.py`） |
| robot tool | app-server 给每个 thread 的动态工具，名叫 `robot` | 每个角色一个 MCP 服务器，`harness/claude/robot_mcp.py` |
| 一次运行的 host | `harness/codex/host/policy_host.js` | `harness/claude/systems/single_agent.py`、`adaptive.py`、`standing_team.py` |
| 唤醒空闲角色 | `harness/codex/host/meta_dispatcher.js` | `harness/claude/systems/dispatch.py`、`adaptive_dispatch.py`、`standing_team.py` |
| delegate fork | `thread/fork`，按父 ID 和历史哈希核对 | `--resume --fork-session`，由 `systems/provenance.py`、`fork_setup.py`、`adaptive_setup.py` 核对 |
| shell 隔离 | Codex 的沙箱，或 `landlock-v1` tool backend | Claude Code 的沙箱，或 `landlock-v1` shell 前缀 |
| preflight | 一份回执 | 两份回执 |
| 容量恢复 | `harness/codex/host/policy_host.js` | `harness/claude/session/recovery.py` |
| host 事件 | 运行里的 `private/logs/host.jsonl` | 运行里的 `private/logs/host.jsonl` |

两种 harness 共用 robot tool 说明（`harness/shared/robot_tool.json`）、运行时程序（`runtime/`）、访问表（`runtime/sandbox/access.py`）、指标（`launch/results/host_metrics.py`）和报告（`launch/results/report.py`）。

<a id="new-requests-queries-and-delegation"></a>
## 新请求、查询和委派

发新请求时不带外层 `call_id`，记下结果返回的 ID。要查询之前的动作，发一个新的 `job` 请求，把旧 ID 放进 `data.call_id`。请求结果不确定、要重试时，用原 ID 重发，操作和参数完全相同；在选择另一个物理动作之前，先确认旧动作的结果。已知的 ID 冲突是一次拒绝；传输结果不确定则不是。错误的 payload 见 [robot tool 的错误反馈](../benchmark/rules.md#robot-tool-error-feedback)。

在 Claude Code 里，robot 请求的 ID 和 CLI 给自己工具调用的 ID（`tool_use.id`）不是一回事。委派之前，host 在 Controller 的 transcript 里找出参数完全一致、还没有答复的那一个工具调用，最多等 10 秒让 transcript 跟上；然后在 fork 之前，把这个对应关系持久保存到 `private/state/claude-tool-bindings/`。依据缺失或有歧义，就拒绝这次委派。

两种 harness 创建 delegate 的结果相同：子 session 的历史停在父 session 那个还没答复的 `delegate` 调用上；它的第一条输入是冻结的 `private/inputs/bootstrap/delegate.md`，按这个子 session 填好；在运行时程序激活这一批 delegate 之前，它不运行任何工具。Codex 先 fork 出一个快照 thread，再从快照逐个 fork 出子 session，激活后再发消息。Claude Code 只能靠运行第一轮来 fork，所以每个子 session 直接从阻塞中的 Controller fork 出来，delegate 消息就是这一轮的输入，并由一个 hook 拦住所有工具调用，直到激活为止（[Claude delegate fork](../../harness/claude-code.md#sessions-and-delegation)）。

<a id="capacity-recovery"></a>
## 容量恢复

两边的 host 用同一条规则（`roboteam/runtime/run/bootstrap.py` 里的 `MAX_CAPACITY_RETRIES`）：某一轮因结构化的容量错误失败后，host 用冻结的 `capacity-resume.md` 恢复同一个 session，最多连续 3 次，间隔 10、20、40 s，再加上由 session ID 固定的 0-5 s 抖动；只要有一轮正常完成，计数就清零。Claude 只认这样的情况：CLI 确定已经退出，session 对得上，错误码是 `rate_limit`、`rate_limit_error`、`overloaded_error` 或 `server_overloaded`；文字里出现“429”不算。已接受或正在执行的 robot 请求要先了结；有未知动作、fork 还没做完、运行处于暂停或收到停止请求时，都不恢复。恢复绝不重新提交运动，也绝不重建 delegate。次数用完后，调度暂停，运行以意外停止结束（[运行何时续跑](../../runs/continuation.md#when-a-run-continues)）。套餐的用量上限不算容量错误：仿真世界会暂停，等额度重置（[用量上限暂停](../../runs/time.md#usage-limit-pause)）。

某一轮如果在断网暂停期间失败，两边的 host 也会在同一个 session 里用冻结的 `network-resume.md` 重发；每个角色在每次暂停里只重发一次（[断网暂停](../../runs/time.md#network-outage-pause)）。正常结束后，两边都给还没结束的各轮最多 30 s，写完最后的回复和用量记录。

<a id="reports-and-metric-definitions"></a>
## 报告和指标定义

所有写入方都停下之后，在跑这个 batch 的环境里执行：

```sh
.venv/bin/python -m roboteam.launch.results.report RUN_DIR
```

这会写出 `RUN_DIR/private/outputs/report.json`，里面有共用的 `host_metrics`。对 Codex，`--codex-home PATH` 指定 session 的 home 目录；不指定时，报告依次用收集到的 session 映射、运行里的 `private/harness/codex-home.json`，最后是环境的默认值。

| 字段 | 含义 |
| --- | --- |
| `usage.input_tokens` | input 总量。input tokens 是模型读入的文字量，决定成本。Claude 把未缓存的 input、缓存读取和缓存写入加在一起；Codex 的 input 本来就包含缓存的 input。 |
| `cached_input_tokens` | 缓存读取；`cache_hit_rate` 是缓存读取占 input 总量的比例。 |
| `cache_write_input_tokens` | Claude 的缓存创建量；Codex 不报告这一项，所以是 `null`。 |
| `output_tokens` | 报告中的 output；thinking tokens 不再重复计入。 |
| `reported_cost_usd` | 报告的费用之和。缺失的费用不当作零，也不假定任何价格。 |
| `usage_complete`、`cost_complete` | evidence 是否覆盖了每一轮。 |
| `known_usage_subtotals` | 只算已知的用量。 |
| `by_actor`、`rows` | 每个角色的合计，以及去重后的各行；`row_unit` 说明一行是 Claude CLI 的一轮，还是 Codex 的一次用量更新。 |
| `model_process_seconds_sum` | 各轮时长之和，包括工具等待和 CLI 开销。 |
| `model_process_wall_seconds_union` | 这些时间区间的并集。 |
| `tool_seconds_sum` | host 记录的工具时长；和模型时间有重叠。 |
| `fork_setup_seconds_sum` | Codex 是 fork RPC 的时间；Claude 是从子 session 第一轮开始，到它复制来的历史核对完为止。 |

Claude 用 `modelUsage`（没有时退回 `usage`，两者不会同时用）。它是每个 session 的累计值，所以每一轮计入的是和上一轮的差。session 最后一个 result 之后的请求，比如后台任务唤醒了空闲的 CLI，从 transcript 里补进来，记为 `after_last_result` 行，合计到 `usage_after_last_result`；这期间如果发生了压缩，`usage_complete` 就是 false。Codex 第一次更新计 `last`，之后计累计值的差。模型时间、工具时间和准备时间互相重叠，不要相加。这些都是 host 观测到的数据，不是服务商的账单。

<a id="harness-differences"></a>
## 两种 harness 的差别

| | Codex | Claude Code |
| --- | --- | --- |
| 每轮的接口 | app-server JSON-RPC | 每轮一个 `claude -p` 进程，用 `--resume` 接着跑 |
| delegate fork | 先建快照 thread，再 `thread/fork`；激活后发消息 | 第一轮就是 fork；激活前由 hook 拦住工具 |
| 压缩 | 到 `auto_compact_token_limit`（267000）时压缩 | `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 设为这个上限，再加上 Claude Code 自带的 33000 token 缓冲 |
| 兼容性回执 | 每个模型一份 | 每个模型两份（basic 和 blocked-parent） |
| 美元额度 | 无 | 可选，`roboteam run` 不设置 |
| 任务时限 | `batch.task_wall_limit_s` | 相同，最多 86400 s |

两者都从 `models.json` 冻结 `context_window` 300000 和 `auto_compact_token_limit` 267000。effort 名字相同，不代表两种 harness 的计算量相同。

<a id="offline-checks"></a>
## 离线检查

见[开发检查](../../development/testing.md)。harness 的测试在 `tests/harness/` 和 `tests/launch/` 下：

```sh
.venv/bin/python -m scripts.dev.run_tests harness launch
```

Claude 物理测试组要手动开启。它跑真实的 MuJoCo 仿真世界和真实的 Claude CLI，连的是本地的合成模型服务，不用付费服务商；需要资源文件和图形后端：

```sh
PYTHONPATH=tests:tests/helpers ROBOTEAM_PHYSICS_SMOKE=1 ROBOTEAM_PHYSICS_BATCH=1 ROBOTEAM_PHYSICS_FINISH=1 \
  .venv/bin/python -m unittest harness.claude.test_claude_physics_smoke harness.claude.test_claude_parallel_physics_smoke \
  harness.claude.test_claude_finish_physics_smoke
```

它们覆盖生成的 ID、原生 fork 和返回、恢复的动作、`finish` 之后的打分（合成任务故意留着不完成，所以评估必须失败），以及收集。

<a id="providers"></a>
## 服务商

<a id="catalogs-and-models"></a>
### 模型目录和模型

模型就是 `models.json` 里的 `codex` 和 `claude` 两部分；运行会把自己 harness 的那部分冻结为 `private/inputs/models.json`。每个条目写明服务商的模型、effort、服务商的 endpoint 和凭据变量。列在目录里，不代表这个模型能在该 harness 上用：能不能用，看它的 preflight 回执。每个 batch 只用一个模型。

<a id="authentication-matrix"></a>
### 认证矩阵

默认值：仓库默认是 Codex 的 `sol`（`gpt-6.1-sol`，effort `high`），用 `OPENAI_API_KEY`。`--harness claude` 时，如果 site TOML 和命令行都没指定模型，就选 `opus`（`claude-opus-5-5`），用 `ANTHROPIC_API_KEY`。

| Harness | 认证方式 | 模型 | 凭据或设置 |
| --- | --- | --- | --- |
| Codex | OpenAI API key | `sol`（默认）、`luna` | `OPENAI_API_KEY` |
| Codex | 经本地适配器转发的 Anthropic API key | `opus_claude_api` | `ROBOTEAM_CLAUDE_GATEWAY_KEY`，一个本地 key；Anthropic key 留在适配器那边（[Claude in Codex](../../harness/claude-in-codex.md)） |
| Codex | ChatGPT 登录 | `sol_subscription`、`luna_subscription`、`terra_subscription`、`astra_subscription` | Codex home 里的登录（[Codex 认证](../../harness/codex.md#authentication)） |
| Codex | 第三方 Responses API | `deepseek`、`qwen`、`glm`、`kimi` | `DEEPSEEK_API_KEY`；`DASHSCOPE_API_KEY` + `DASHSCOPE_BASE_URL`；`ZAI_API_KEY`；`KIMI_API_KEY` |
| Claude | Anthropic API key | `opus`（默认）、`haiku` | `ANTHROPIC_API_KEY` |
| Claude | 订阅 token（`claude setup-token`） | `opus_subscription_token`、`haiku_subscription_token` | `CLAUDE_CODE_OAUTH_TOKEN` |
| Claude | 已保存的登录，默认目录 | `opus_subscription`、`haiku_subscription` | `ROBOTEAM_CLAUDE_HOME` = `$HOME/.claude`，不设置 `CLAUDE_CONFIG_DIR` |
| Claude | 已保存的登录，指定目录 | `opus_subscription_directory`、`haiku_subscription_directory` | `ROBOTEAM_CLAUDE_HOME` = 登录时用的 `CLAUDE_CONFIG_DIR` |
| Claude | 经本地适配器转发的 ChatGPT 套餐或 OpenAI API key | `sol_chatgpt_plan` | `ROBOTEAM_CHATGPT_GATEWAY_KEY`，一个本地 key；OpenAI 凭据留在适配器那边（[GPT in Claude Code](../../harness/gpt-in-claude-code.md)） |
| Claude | 第三方 Anthropic 兼容 API | `kimi`、`kimi_code`、`qwen`、`glm`、`deepseek` | `KIMI_API_KEY`；`KIMI_CODE_API_KEY`；`DASHSCOPE_API_KEY` + `DASHSCOPE_ANTHROPIC_BASE_URL`；`ZAI_API_KEY`；`DEEPSEEK_API_KEY` |

这张表和 `models.json` 不一致时，以 `models.json` 为准。

<a id="codex-responses-endpoints"></a>
### Codex 的 Responses endpoint

对第三方 Codex 模型，harness 写一个只在本进程里生效的 provider 条目，从不改全局的 Codex 配置。以 DeepSeek 为例，它长这样：

```toml
[model_providers.deepseek]
name = "deepseek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
request_max_retries = 3
stream_max_retries = 3
```

Kimi 用 `https://api.moonshot.cn/v1`，智谱用 `https://open.bigmodel.cn/api/v1`；Qwen 从 `DASHSCOPE_BASE_URL` 读取工作空间的 endpoint，它必须是该账号兼容 Responses 的 base URL（例如 `https://<WorkspaceId>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`）。runner 需要 Responses API，Chat Completions endpoint 或 `wire_api = "chat"` 都不行。参见 [Codex 配置参考](https://developers.openai.com/codex/config-reference/)。

<a id="claude-compatible-endpoints"></a>
### Claude 兼容的 endpoint

每个第三方 Claude 模型的 Anthropic 兼容 `base_url` 都写在模型目录里；Qwen 从 `DASHSCOPE_ANTHROPIC_BASE_URL` 读取，它必须和账号所在的地域一致。`kimi`（Moonshot API）和 `kimi_code`（Kimi Code 套餐）用的 key 和 endpoint 不同。做付费检查之前，先看服务商的条款是否允许无人值守的并行使用；不要混用 coding 套餐和按量付费的 key。

<a id="local-checks-and-preflight"></a>
### 本地检查和 preflight

```sh
.venv/bin/roboteam doctor --harness codex --model kimi
.venv/bin/roboteam plan --harness codex --model kimi --level 1 --min-arms --parallel 4
```

`doctor` 检查已安装的 CLI、它的沙箱或 tool backend，并做一次真实渲染；它不调用模型，也不检查凭据。付费检查按 harness 分开：[Codex preflight](../../harness/codex.md#preflight-and-receipts)、[Claude preflight](../../harness/claude-code.md#preflight-and-receipts)。模型、endpoint、effort、模型目录或 CLI 版本只要有变化，就要重新拿一份回执。

<a id="selection-and-concurrency"></a>
### 选择范围和并发

| 选择 | 每个模型的运行数 |
| --- | ---: |
| `--level 1 --min-arms` | 4 |
| `--level 1` | 12 |
| 全部难度 | 36 |

`--level 1 --min-arms` 选出每种任务类型在 Level 1 规模最小的 case，分别是 4、4、8、4 条机械臂。`batch.parallel` 数的是整次运行；delegate、常驻的 Worker 和 fork 会在每次运行内部增加 session 和模型请求，所以限制吞吐量的是 CPU、内存、渲染和服务商的速率限制，而不是这个设置。同时跑的多个 batch 会叠加。Dial 每个任务的每次运行都用 `benchmark/release.json` 里固定的密码，所以所有模型面对的谜题相同。

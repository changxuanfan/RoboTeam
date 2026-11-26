[English](../../benchmark/rules.md) | 简体中文
> 本文译自英文版（commit 985a5b02），内容以英文版为准。

<a id="rules-of-a-run"></a>
# 运行规则

每次运行从开始到打分，都要遵守这里的规则：agent 拿到什么、看到什么，robot 请求怎样标识，任务算不算完成由什么决定。准备运行时，输入、源代码和所用规则的名字都会冻结下来（记在私有任务文件的 `run_protocol` 里），所以看旧的运行，要以它当时的记录为准。两种 harness 的差别见 [harness 指南](../harness/README.md)。时间怎么算，见[时间和暂停](../../runs/time.md)；停下的运行怎么续跑，见[续跑停下的运行](../../runs/continuation.md)。

几个用词：*policy* 指被测的那组 agent，*角色* 是其中的一个 agent。*host* 是替一次运行管理各角色 session 的进程。*world owner* 是推进物理仿真的进程。

<a id="a-run-in-six-steps"></a>
## 一次运行的六个步骤

1. **时钟一旦开始就不会停。** 厂房按实时仿真，agent 思考时它不会等；决定得慢，耗掉的就是工作时长。
2. **agent 看画面。** 它们拿到固定相机拍的图像和自己机械臂的状态。物体位置、深度、接触信息，一概不给。
3. **agent 自己分工。** 可以由一个 agent 控制所有机械臂，也可以由 controller 拆分任务，把机械臂交给 helper。四种 agent system 见下表。
4. **只用一个 robot tool 动手。** 把机械臂移到某个位姿；让夹爪张开、合拢或抓取。能对机械臂下的命令只有这些。
5. **agent 自己检查。** 没有任何提示会告诉它们成功了。agent 要再看一遍；移动或抓取失败了，就重试。每次失败都留在记录里。
6. **运行结束**：agent 宣布任务完成，或者工作满 24 小时。之后由一个 agent 接触不到的评估程序判定任务是否真的完成。

agent 运行在一个 coding-agent 程序里，也就是 harness：Codex 或 Claude Code。除非设置里关掉，agent 还能在沙箱里自己写 Python、自己运行，比如在图像里量出方块的位置。沙箱把它们和仿真器、评估程序隔开。它们还共用一本经验笔记，每次运行开始时都是空的。

| agent system | 设置值 | 团队怎样组织 |
| --- | --- | --- |
| Adaptive | `adaptive` | 一个 controller，负责创建 helper，把机械臂分给它们，再把机械臂收回。默认选项。 |
| Single-agent | `single-agent` | 一个 agent 控制所有机械臂。 |
| Hierarchical | `hierarchical` | 每条机械臂一个 worker，上面有一个 controller。 |
| Decentralized | `decentralized` | 每条机械臂一个 worker，没有 controller。worker 之间直接协调。 |

<a id="start-system-prompt-start-message-start"></a>
## 开始：系统提示词、开场消息、START

- **系统提示词。** `private/inputs/bootstrap/system.md` 前面是 policy 的角色说明，后面接这次运行的 `public/inputs/rules.md`。Claude Code 通过 `--system-prompt` 收到它；Codex 把它作为每个 thread 的 `baseInstructions`，delegate 也一样。两种 harness 拿到的字节完全相同，对话压缩后它也保持完整。
- **开场消息。** 每个初始角色的第一条消息（`private/inputs/bootstrap/<role>.md`）完整带上它的其他公开文本输入：`task.json`、`roles.json`、它的角色文件、协作指南，按 agent system 的需要带上 tool、motion-check、communication 和 adaptive 几份参考，以及任务材料，每一份都标明绝对路径。这些文件在磁盘上照样可读。消息最多 400000 字节。两种 harness 只有最后一行不同（怎样查看图像）。
- **START。** host 准备好仿真世界，给每个初始角色各开一个 session。然后运行时程序记下一次 START，host 再把开场消息发给各个角色。冻结的 `startup_protocol` 记下了这种方式：`single-agent` 和 `adaptive` 是 `direct_controller`，`hierarchical` 和 `decentralized` 是 `direct_team`。读材料、观察、做计划都算任务时间。第一次投递失败或结果不确定，算工程故障，留给人复查；绝不在同一个仿真世界里重试，也绝不当作任务结果上报。
- **`ready`** 是一个可选的查询，返回该角色的机械臂、运行限制和静态的 `robot_facts`。它不解锁 START。
- **时间。** 公开的 `task.json` 不写时间限制（`run_protocol.total_wall_limit_s` 和 `run_protocol.clock` 只在私有任务文件里），规则也要求 policy 当作时间不受限制来做计划。host 给每次运行 24 小时有效时间（`active_time_v1`），到达这个时间上限时打分（[计时方法](../../runs/time.md)）。

两种 harness 里的 `public/inputs/rules.md` 是同一份文字。但每种 harness 仍按自己的方式把 robot tool 交给模型，所以实验条件是 harness、它的 CLI 版本和模型三者合在一起：规则相同，不等于模型的上下文或工具的表现也相同。

<a id="observation-images"></a>
## 观测图像

`render.observation_profile = "jpeg_1280x800_q90"`（默认值）让每台观测相机输出 1280 × 800、质量 90 的 JPEG。`jpeg_128x80_q95` 是低分辨率条件：每张图先按 1280 × 800 渲染，再把每个 10 × 10 的像素块平均成一个像素，然后以质量 95 编码。运行的设置把它冻结为 `observation_image_profile`，公开的任务文件写明格式和分辨率。公开的相机标定如果写了图像尺寸，运行拿到的是按观测分辨率改过的副本，公开的原文件不变。录像另有自己的分辨率。

发布的任务在厂房里自己的工位上运行（`roboteam/sim/hall/world.py`）。厂房和其余 35 个工位都停在各自任务开始时的状态，立在周围不动，也不参与碰撞，所以有没有它们，运动都一样。图像从仿真世界模型的一份副本里绘制（`roboteam/sim/render/look.py`）：颜色和纹理先转到线性光，厂房的主光投出硬阴影，每张图只做一次显示变换。一张图只画可能出现在画面里、或可能给画面投下阴影的厂房几何体。画出来的结果和全部画出时一样：某些视角下，抗锯齿会让少数几个像素差 1 级（共 255 级）。其他工位上的机械臂用简化网格绘制。在笔记本 GPU 上，一张图要 10 到 40 ms。实时画面和录像用同样的方法绘制。

<a id="ground-truth-observation"></a>
## Ground-truth 观测

用 `policy.observation = "ground_truth"`（或 `--observation ground_truth`）准备的运行，角色拿到的是仿真器的状态，而不是相机图像。其余和普通运行完全一样：同样的 robot tool，同样的动作和时序，同样实时运转的仿真世界，同样的打分。任何 harness、模型和 agent system 都可以选它。默认值是 `images`。论文里的 Oracle 条件，也就是项目网页上的 Oracle，用的是 Codex、模型条目 `sol` 和 single-agent system：

```sh
.venv/bin/roboteam prepare --output runs/batches/<batch> --harness codex --model sol \
  --system single-agent --observation ground_truth
```

角色能拿到：

- **`state`**：一个只读的 robot 操作。它返回仿真时间；每个任务物体的位置、四元数（wxyz）、线速度和角速度；任务场景里每个关节的 `[position, velocity]`，按名字列出（机械臂、手指、旋钮的铰链、板上的弹簧；自由关节或球关节给出完整的位置和速度向量）；以及评估程序当前跟踪的内容：进度、已达成的目标、违规，以及任务是否完成（START 之前是 `{"started": false}`）。
- **`public/inputs/ground-truth/`**：`task.json` 是评估程序手里的那份任务（物体、目标、精确的目标位置、机构、完成规则）；`scene.xml` 和它的 `assets/` 是任务的 MuJoCo 场景，不含厂房。公开的 `task.json` 把这个文件夹记作 `ground_truth`。
- **一个仿真器**：[policy environment](../../hosts/policy-environment.md#the-mujoco-variant) 的 `mujoco` 变体，也就是普通环境再加上 benchmark 自己所用版本的 `mujoco` 包。

角色拿不到：

- **相机图像。** `observe` 只返回机械臂的反馈。不渲染、也不写出任何图像，动作结束时也一样。`cameras`、`views` 选项和 `public_image` 一律拒绝，公开的任务里也不出现任何相机、标定或参考图像。录像和实时画面是给人看的，保持原样。
- **robot 动作以外改变仿真世界的办法。** `state` 从不写入。角色自己跑的仿真，用的是它自己的副本。
- **任何私有内容。** 和所有运行一样，运行的 `private/` 文件夹、时间上限和 benchmark 的代码都不开放。

**Dial 的密码在任何运行里都保密。** 密码放在 `benchmark/release.json` 的私有部分，只以 `private/inputs/suite-code.json` 的形式进入运行。ground-truth 任务文件里没有密码。在 Dial 里，`state` 给出旋钮角度（作为关节状态），以及使用图像的角色能在显示屏上看到的内容：BEST 值和 READY 状态，外加 solved 标志、有效尝试的次数、每个模块的支撑和间隙，以及违规。它从不给出密码，也不说哪个旋钮是对的。

`ground_truth` 不能和 `tools = "robot_only"` 一起用：角色需要它的 code tools。ground_truth 运行在 `private/inputs/run.json` 里冻结 `"observation": "ground_truth"`。Codex 为它单独保存一份 preflight 回执 `<model>.ground_truth/`。提示词里两种模式不同的段落，在模板里用 `<!-- observation:images -->` 和 `<!-- observation:ground_truth -->` 标出（`roboteam/tasks/observation_mode.py`）。测试：`tests/runtime/tools/test_ground_truth.py`、`tests/launch/test_observation_mode_configuration.py` 和 `tests/runtime/sandbox/test_policy_env_variant.py`。

<a id="robot-requests-and-ids"></a>
## robot 请求和 ID

无论用哪种 harness，发新的 robot 请求时都不要带外层 `call_id`；host 会生成一个并返回。要查询之前的某个物理动作，就发一个新请求 `{"op":"job","data":{"call_id":"ACTION_ID"}}`，同样不带外层 `call_id`：这次查询有自己的 ID，`data.call_id` 指明要查的动作。某个请求结果不确定、想重试时，用它原来的外层 ID 重发，操作和数据必须完全相同。结果不确定的物理动作，绝不能换一个新 ID 重放。Claude Code 的 host 怎样把这些 ID 和 CLI 自己的工具调用对上，见[新请求、查询和委派](../harness/README.md#new-requests-queries-and-delegation)。

阻塞式动作过了 600 s 还没结束，会以原 ID 返回 pending（harness 可能更早放弃这次工具调用）；动作继续执行，可以用 `job` 跟踪。

<a id="robot-tool-error-feedback"></a>
## robot tool 的错误反馈

两种类型化错误用来区分冲突和结果未知。两者都不会生成 ID、重放命令、重启仿真世界，也不会延长截止时间。

| 错误 | `request_status` | 含义 |
| --- | --- | --- |
| `CALL_ID_CONFLICT` | `rejected`（`original_call_status: unknown`） | 拒绝的只是重用了 ID 的这个新请求。最初用这个 ID 发出的请求可能已经执行，也可能还会执行：先查自己的 `pending` 记录；如果是物理动作，再用原 ID 发 `job`。查清之后，只有确实要发一个新请求时，才该用新 ID。不会透露其他角色的请求 |
| `TRANSPORT_UNCERTAIN` | `unknown` | 超时、回复丢失、输出格式错误、未知错误码或 ID 不匹配。它不能说明操作没有执行；持久保存的请求仍然可以用原 ID 找到 |

客户端在提交改过的请求之前，会先在本地发现冲突。服务端发现自己整个任务范围的调用表里有冲突时，返回 HTTP 409 JSON；客户端核对 schema 和 ID，把这次拒绝单独记下，不列为未解决。Codex 根据出错客户端的 JSON 重建一份只含白名单字段的响应，所以原始 stderr 和命令行永远到不了 policy；Claude MCP bridge 用的是同样的类型化异常和 payload。

离线检查（不调用模型，不跑物理）：

```sh
PYTHONPATH=tests:tests/helpers .venv/bin/python -m unittest runtime.tools.test_tool_errors \
  runtime.tools.test_pipeline_client runtime.world.test_runtime_store harness.claude.test_claude_tool_errors
node --test tests/harness/codex/test_tool_errors.js
```

<a id="ik-failure-detail"></a>
## IK 失败的详细信息

逆运动学（IK）求的是让手到达指定位姿的关节角。手的参考点是 tool center point（TCP）。`move`、`check_motion` 的候选位姿，或 `action_batch` 里的某一项，如果位姿没有经过验证的 IK 解，执行前就直接拒绝，并返回 `error` 和 `ik_detail`：

| 字段 | 含义 |
| --- | --- |
| `closest_found_tcp_m`、`position_error_m`、`rotation_error_rad` | 求解器找到的最接近的 TCP 位姿，以及它离请求的位姿有多远 |
| `horizontal_distance_from_base_m` | 目标和这个位姿各自到机械臂底座的水平距离 |
| `orientation` | 所用的朝向：请求里的 `quaternion_wxyz`，或者保留的当前朝向 |
| `home_orientation` | 换成机械臂 home 位的手部朝向后，同一位置能不能解出来，以及这个四元数 |

求解器从当前的关节参考值出发做局部搜索，所以这些只是求解器给出的事实，既不能证明到了可达范围的极限，也不是建议的目标。这里不用任何物体状态。额外的 home 朝向求解只在拒绝之后才运行（`roboteam/sim/robot_control.py`）。

<a id="terminal-outcome"></a>
## 终局结果

运行按结束时仿真世界的状态打分（冻结的 `run_protocol` 里的 `terminal_outcome_v2`）。任务是否完成，看任务的最终条件：

- **Transport 和 Mosaic：** 每个目标的几何、释放、稳定和分配谓词。
- **Relay：** 每根木料都经过一次合格的空中交接（`relay-airborne-handover-v1`），并且松开后中心线至少有 70% 在 GOAL 轮廓上方（`relay-timber-goal-70pct-v1`）。
- **Dial：** 一次同时、有效且正确的输入让装置解锁，成功就此锁定；之后再转旋钮也不会撤销。

掉落标记和记下的违规，不影响任务算作完成。报告里保留 `strict_task_success`、流程合规情况和违规；Relay 的报告还保留 `process_goals_met`、`process_completed_payloads`、掉落和交接记录。违规条目按种类和键去重，不是单独碰撞的次数。失败和未解决的动作，和流程违规分开报告。中断或未解决的运行，永远不会算成成功；接受 `finish` 也不等于判定成功。

<a id="contact-and-drop-metrics"></a>
### 接触和掉落指标

`robot_contact_episodes` 报告采样得到的接触 episode，范围是不同机械臂之间、以及同一条机械臂自身的刚体对，用的是碰撞阈值（穿透超过 0.2 mm 和 1 mm）。仿真时间里间隔不超过 50 ms 的接触合并成一次。报告给出每个刚体对的次数和最大的采样间隔；它数的是刚体对的 episode，不是物理撞击。这些计数都不改变终局的成功判定。

Relay 的 `drops` 来自它的空中、支撑和接触状态机，不是物理掉落的完整计数。Transport、Mosaic 和 Dial 没有验证过的通用掉落计数器：没有这项指标，意思是没有测，不是零。Dial 操作红色部件时的支撑违规，只在解锁之前检测。

<a id="fixed-runtime-rules"></a>
## 固定不变的运行规则

运行的一部分规则是 `roboteam/runtime/run/defaults.json` 里的数值。`roboteam.toml` 的任何设置、任何命令选项都改不了它们，每次准备运行时都会把它们冻结到 `private/inputs/run.json` 里。改这个文件，测量的东西就变了。

| 规则 | 取值 | 字段 |
| --- | --- | --- |
| 单个动作超时前允许的时间 | 30 仿真秒加上预估时长的 1.5 倍，最多 600 | `action_timeout_sim_s`、`max_action_timeout_sim_s` |
| 角色之间单条消息的最大长度 | 8000 个字符 | `max_message_chars` |
| 一次投递给一个角色的最多消息数和字节数 | 32 条消息，32768 字节 | `max_batch_messages`、`max_batch_bytes` |
| 角色可以保存的复查期限（`after_s`）；上限同时也是同步超时的上限 | 1 到 600 秒 | `min_check_interval_s`、`max_check_interval_s` |
| 间隙低于这个值，motion check 就报告该计划动作 | 0.02 m，预览最长 15 s | `motion_check` |
| 运动记录和录像的频率 | 每仿真秒 30 次 | `motion_hz`、`video_fps` |

运行的时间上限不在这个文件里：它是 `batch.task_wall_limit_s`（`--wall-limit`），默认 24 小时，最多也是 24 小时（[时间和暂停](../../runs/time.md)）。

<a id="database-write-contention"></a>
## 数据库写入争用

每次运行把状态存在一个 SQLite 数据库里（`private/state/runtime.sqlite`），用 WAL 模式，busy timeout 是 30 秒。非嵌套的 `BEGIN IMMEDIATE` 返回普通的 `SQLITE_BUSY` 时，最多尝试 4 次，间隔 0.25 s，总共约 120.75 s。警告写进标准日志，不写进正在争用的数据库，内容包括耗时、尝试次数和结果。嵌套的 savepoint、事务内部的错误、commit、扩展 busy 码和其他错误都不重试（`roboteam/runtime/world/sqlite_busy.py`）。

本地 HTTP 客户端的默认超时，是这个最长等待时间再加 45 s；调用方明确给出的超时保持不变。超时说明不了动作有没有执行：要对账，或者用原 ID 查询。Claude 的预算账本用同样的写入策略。

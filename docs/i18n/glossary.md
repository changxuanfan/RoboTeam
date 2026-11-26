# 中文版术语表

本表适用于中文版的 README、文档（`docs/zh-CN/`）、项目网页（`/zh/`），以及宣传片、图表里的文字。英文版是原文，中文版以它为准。

## 总原则

- 专有名词、术语、代码相关的写法，一律保留英文原文，不加中文翻译，也不加引号。
- 简短的界面标签（状态、单位、速度、"Coming soon" 这类）保留英文。
- 句子、说明、段落用中文，读起来要像中文母语者直接写的，不能一看就是翻译。
  - 先弄清英文想说什么，再用中文的说法重写，宁可意译，不要直译。例："Seeing is the hard part." 写成"难就难在看。"；"Same score, very different bill." 写成"分数差不多，账单差很多。"
  - 少用"的"字串、"被"字句、"进行"，不照搬英文语序和名词短语。
  - 时长在中文句子里写"41 分钟""3 小时 45 分钟"；图表刻度和保留英文的标签里仍写 h、min。
- 同一个词在所有地方写法相同。本表没有收的词，先补进本表，再用。

## 一、保留英文：名称

| 英文 | 中文版写法 | 说明 |
| --- | --- | --- |
| RoboTeam | RoboTeam | benchmark 的名字 |
| Transport, Mosaic, Relay, Dial | Transport、Mosaic、Relay、Dial | 四种任务类型的名字 |
| Level 1, Level 2, Level 3 | Level 1、Level 2、Level 3 | 难度；句中可写"Level 3 的任务" |
| Small, Medium, Large | Small、Medium、Large | 团队规模；句中可写"Large 团队" |
| Flat, Sockets, Sprung 等难度名称 | 原文 | 见第五节的完整列表 |
| gpt-6.1-sol, opus-5.5, kimi-k3.1-pro, qwen3.8-flash, deepseek-v4.1-flash, glm-5.3-flash | 原文，全小写 | 模型名 |
| Codex, Claude Code | Codex、Claude Code | harness 的名字 |
| Oracle | Oracle | 拿到所有物体真实位置的对照条件，见第三节 |
| Single-agent, Hierarchical, Decentralized, Adaptive | 原文 | 四种 agent system 的名字；句中写"single-agent system" |
| A_front, A_side, top, board_H_close 等 | 原文 | 相机名，用等宽字体 |
| Arm A, Arm H | Arm A、Arm H | 指某一条机械臂时；泛指时用"机械臂" |
| controller, worker, helper, delegate | 原文 | agent 的角色名 |

## 二、保留英文：术语

| 英文 | 中文版写法 | 说明 |
| --- | --- | --- |
| benchmark | benchmark | 不译作"基准测试" |
| agent | agent | 不译作"智能体"；复数也写 agent |
| agent system | agent system | 句中可写"四种 agent system" |
| harness | harness | 首次出现时补一句中文解释：包住模型的 coding-agent 程序 |
| robot tool | robot tool | agent 控制机械臂用的工具 |
| code tools | code tools | agent 自己写代码、运行代码用的工具 |
| input tokens, output tokens | input tokens、output tokens | 首次出现时补一句：模型读入的文字量，决定成本 |
| atomic failure rate | atomic failure rate | 首次出现时补一句中文解释 |
| ground-truth position | ground-truth position | 句中写"物体的 ground-truth position" |
| real time | real time | 用作标签时保留英文，如"300× real time"；句中可写"实时" |
| episode, trial, segment | 原文 | 只在技术文档里出现 |
| CLI 命令、参数、配置键、文件名、路径、环境变量 | 原文，放进代码格式 | 例：`roboteam plan --task-types relay` |

## 三、保留英文：界面标签和固定短语

| 英文 | 中文版写法 | 说明 |
| --- | --- | --- |
| Completed / Not completed | Completed / Not completed | 状态标签；句中写"完成""没有完成" |
| Coming soon | Coming soon | 视频还没有时的标签，不写原因 |
| 300× real time, 10× real time | 原文 | 速度标签 |
| 16 arms · 24 h · cameras only · never pauses | 原文 | What is new 图里的标签 |
| 2× the time, 3× the tokens | 原文 | 图上的标注；正文里写"2 倍的时间""3 倍的 input tokens" |
| RUN START, NEW PICTURE, LATER IN THE RUN, PICTURE COMPLETE, TASK COMPLETED | 原文 | 宣传片里的大写标签 |
| Oracle 的说明 "the same AI, given the ground-truth position of every object" | 同一个 AI，拿到每个物体的 ground-truth position | 只在说明文字里翻译 |

## 四、翻译成中文

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| arm, robot arm | 机械臂 | 数量写"16 条机械臂"；标签处可保留"16 arms" |
| task | 任务 | 指 36 个任务之一 |
| job, task type | 任务类型 | 指四种之一；不要和"任务"混用 |
| team | 团队 | 一个模型加一种 agent system 跑出来的一组运行 |
| team size | 团队规模 | 具体规模写 Small、Medium、Large |
| level | 难度 | 具体难度写 Level 1–3 |
| run | 运行 | "一次运行""整次运行" |
| step | 步骤 | 一条机械臂完成的最小进度，例如放好一块方块 |
| camera | 相机；录像里的视角叫"机位" | agent 用的是相机，front camera 写"前视相机"；播放器里的 front、side、top 写"正面机位""侧面机位""俯视机位" |
| picture, image | 画面（视频里）、图像（输入给 agent 时） | |
| factory hall, hall | 厂房 | |
| simulation, simulated | 仿真 | |
| world | 仿真世界 | "世界不会暂停"可直接写"仿真不会暂停" |
| finish (a task) | 完成 | |
| fail, failure | 失败 | |
| retry | 重试 | |
| handover | 交接 | Relay 里在空中把木料交给另一条机械臂 |
| cube, timber, knob, crank | 方块、木料、旋钮、曲柄 | 物体名称；任务说明里第一次出现时可括注英文 |
| cutoff (24 h) | 24 小时上限 | |
| hours of work | 工作时长 | |
| video | 录像（某次运行的录像）、视频（泛指） | |
| film | 宣传片 | |
| project page | 项目网页 | |
| paper | 论文 | |

## 五、难度名称（保留英文）

| 任务类型 | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Transport | Flat | Sockets | Sprung |
| Mosaic | Pockets | Lines | No grid |
| Relay | Straight | Curved | Hinged |
| Dial | Table | Lifted | Crank |

难度的一句话说明（`tasks.json` 里的 `level_note`，例如 "Straight timber"、"No visible grid"）翻译成中文：直的木料、没有可见的网格。

## 六、网页的栏目、标题和按钮

| 内容 | 中文版写法 | 理由 |
| --- | --- | --- |
| 网页顶部的标签页 Overview / Results / Videos | 保留英文 | 是网页的固定栏目名，和英文版一一对应 |
| 小节的小标题（kicker），如 WHAT IS NEW、HOW A RUN WORKS | 保留英文 | 等宽大写字体不适合中文；保留英文也和英文版对应 |
| 小节的大标题，如 "Seeing is the hard part." | 翻译成中文 | 是完整的句子 |
| 按钮，如 See the results、Watch every run、See all nine tasks | 翻译成中文 | 是要读懂才会点的操作 |
| 论文标题 | 保留英文 | 正式名称 |

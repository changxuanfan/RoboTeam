[English](../../development/repository-layout.md) | 简体中文
> 本文译自英文版（commit cabcac8d），内容以英文版为准。

<a id="repository-layout"></a>
# 仓库结构

每个顶层文件夹只管一件事。新加文件时，按下面写的分工放进对应的文件夹。哪个文件夹都不合适，这个文件多半属于某个运行目录或输出目录，不该进 Git。

```text
RoboTeam/
  benchmark/        the released tasks (4 task types x 9 cases), the pinned asset archive and the hall
  roboteam/         the Python package: sim, tasks, runtime, harness, launch, analysis
  prompts/          every text a model reads: rules, roles and guides
  scripts/          engineering commands: release, analysis, site, dev
  tests/            the tests, laid out like the package
  docs/             guides
  site/             the project page
  docker/           the container image
  .github/          CI workflows
```

根目录下的文件：

| 文件 | 是什么 |
| --- | --- |
| `README.md` | benchmark 的介绍 |
| `roboteam.toml` | 新运行的默认设置 |
| `models.json` | 模型列表，每个 harness 一节。harness 是包住模型的 coding-agent 程序 |
| `pyproject.toml`、`uv.lock` | Python 包（Python 3.12，见 `requires-python`）和锁定的环境 |
| `.env.example` | 凭据模板 |
| `LICENSE`、`LICENSE-DATA.md` | 代码的许可证，以及数据和媒体的许可证 |
| `CITATION.cff` | 论文的引用格式；GitHub 会从根目录读取它 |
| `.gitignore`、`.gitattributes` | Git 设置 |

<a id="the-package"></a>
## Python 包

每个文件夹里还都有一个 `__init__.py`。

```text
roboteam/
  cli.py                 the `roboteam` command
  configuration.py       loads and validates roboteam.toml, a site TOML and command options
  io.py                  the repository root, file hashes, atomic JSON writes, file clones, the .env loader
  sim/                   the simulation
    robot_control.py     the arm and hand controller
    kinematics.py        inverse kinematics
    franka_limits.py     the speed, acceleration and force limits of a real Franka Panda
    motion_check.py      sampled checks of planned moves against other arms
    profile.py           physics settings a scene file cannot hold
    health.py            fails a step on a numeric failure
    workstation.py       reads a frozen workstation's visible poses
    motion_recording.py  the recording of a run's motion
    live_video.py        MP4 recording while a run runs
    timing.py            the time allowance of one action
    render/              worker.py image.py look.py backend.py cocoa.py
    hall/                build.py (the factory hall scene) desks.py (the cases placed in it) labels.py
                         flat.py (the built hall that runs load) world.py (a task at its desk in the hall)
  tasks/                 the released tasks and their scoring
    task_types.py        resolves a released case and its public facts
    config.py            one task definition for the scene and the public task
    public.py            the public task, and checks of a released task against its scene
    scene.py             scene checks, freezing a scene into a run, camera names
    ground_truth.py      the files of a ground_truth run
    tools_mode.py        the `tools` condition: full or robot_only
    observation_mode.py  the `observation` condition: images or ground_truth
    provenance.py        content fingerprints of scenes and logic
    evaluate.py          the evaluator: process events and completion
    dial.py              the Dial feedback rules
    relay_goal_fraction.py   how much of a timber lies over GOAL
    contact_episodes.py  counts of robot contact episodes
  runtime/               what runs inside one run
    world/               pipeline.py service.py store.py sqlite_busy.py effective_physics.py seal.py
                         fault_injection.py dashboard.html
    tools/               the robot tool: robot_ops.py action_batch.py delegation.py scheduling.py
                         run_skills.py public_files.py stop_diagnostics.py tool_errors.py
                         ground_truth.py (the `state` operation) pipeline_client.py
    run/                 setup.py bootstrap.py layout.py (where every file of a run is) segments.py
                         versions.py diagnostics.py host_log.py admin.py (operations on one run, for
                         the hosts and the operator) defaults.json (the runtime's default settings)
    time/                clock.py quota.py outage.py egress_pause.py egress_record.py
    sandbox/             access.py policy_env.py policy_env_probe.py
      policy-env/        core.in core.lock store.in all.lock mujoco.in mujoco.lock
  harness/
    codex/               launch.py job_harness.py recover_task.py tool_backend.py file_sandbox.py
                         tool_worker.py desktop_robot_mcp.py
      checks/            cli.py broker.py snapshot.py
      host/              the Node.js host: policy_host.js rpc.js gateway_rpc.js job_gateway.js
                         tool_broker.js meta_dispatcher.js initialize.js preflight.js borrowed_auth.js
                         model_template.json
    claude/              run.py supervisor.py recover_task.py robot_mcp.py models.py
      session/           runner.py session_host.py session_host_base.py native_home.py budget.py
                         cost_state.py session_recovery.py (the recovery rules) recovery.py (their
                         adapter to Claude Code's session history)
      systems/           single_agent.py adaptive.py adaptive_dispatch.py standing_team.py dispatch.py
                         fork_setup.py adaptive_setup.py provenance.py request_identity.py
      checks/            preflight.py readiness.py blocked_precheck.py offline_probe.py
    shared/              what both harnesses import: landlock.py tool_worker.py owner.py recovery.py
                         identity.py native.py preflight_probe.py robot_mcp.py robot_tool.json
    adapters/
      claude_in_codex/   gateway.py monitor.py requirements.txt
      gpt_in_claude/     gateway.py auth.py websocket.py requirements.txt
  launch/                prepare.py cases.py supervise.py launch_schedule.py codex_batch.py
                         claude_batch.py claude_prepare.py
    local/               mac.py linux.py
    slurm/               job.py auth.py proxy.py
    container/           container.py entrypoint.py
    results/             collect.py archive.py archive_batch.py session_archive.py report.py (these
                         write a batch's evidence)
                         host_metrics.py assets.py
  analysis/              analysis of finished runs: run_files.py (reads a run from a folder, tar or
                         zip) extract.py metrics.py atomic.py motion.py motion_query.py paired.py
                         session_archive.py (summarizes a session archive)
```

子包之间分层依赖：`sim` 不导入其他任何子包；`tasks` 导入 `sim`；`runtime` 导入这两个；`harness` 导入 `runtime`；`launch` 导入 `harness`；`analysis` 读的是已经结束的运行。`tests/repo/test_layering.py` 负责检查这套分层。

<a id="tracked-folders"></a>
## 进 Git 的文件夹

| 文件夹 | 放什么 | 不放什么 |
| --- | --- | --- |
| `benchmark/` | `README.md`；`release.json`；`assets.json`，锁定资源压缩包的版本；每种任务类型一个文件夹（`transport/`、`mosaic/`、`relay/`、`dial/`），里面有 `catalog.json` 和九个 case 文件夹，每个 case 文件夹里有 `scene.xml`、`task.json`、`environment.json`、`workstation.json` 和 `public/`（公开任务，以及运行会拿到的任务材料）；`hall/`，厂房的源文件（`layout.json`、`fonts/`、`textures/`、`source/`）。见 [benchmark/README.md](../../../benchmark/README.md) | 场景草稿；运行结果 |
| `roboteam/` | 上面列出的 Python 包。数据文件和读它的代码放在一起：仪表盘页面挨着提供它的 world，`defaults.json` 挨着运行的 setup 代码，policy environment 的锁文件挨着 `policy_env.py`，每个适配器的 `requirements.txt` 挨着它的 gateway | 运行数据；一次性的工具 |
| `prompts/` | `rules.md`；`roles/`，每个角色一份提示词（`single-agent.md`、`adaptive-controller.md`、`team-controller.md` 对应 `hierarchical`、`worker.md`、`meta-manager.md`）；`guides/`，包括 `collaboration/`（`guide.md`、`tools.md`、`communication.md`、`adaptive.md`、`motion-check.md`）和每种任务类型一份指南（`transport.md`、`mosaic.md`、`relay.md`、`dial.md`） | 模型不读的任何东西（给外层 manager 的提示词在 `docs/development/` 里） |
| `scripts/` | 工程师用 `python -m scripts.FOLDER.NAME` 运行的命令，分在 `release/`、`analysis/`、`site/` 和 `dev/` 里，每条都列在 [scripts/README.md](../../../scripts/README.md) 中 | 库代码（放进 `roboteam/`） |
| `tests/` | `test_*.py`、`test_*.js` 和一个 `.cjs` 文件，目录结构和 Python 包一致：`sim/`（含 `hall/`）、`tasks/`、`runtime/{world,tools,run,time,sandbox}/`、`harness/{codex,claude,shared,adapters}/`、`launch/`、`analysis/`，以及检查仓库本身和脚本的 `repo/`。`helpers/` 放测试共用的东西（`fake_pipeline.py`、`fake_session.py`、`motion.py`、`single_arm_scene.py`、`team_settings.py`、`relay_contract.py`、`claude_batch_control.py`、两个模型服务商的替身和三个 Node.js 客户端）；测试运行器会把它加进导入路径。见[测试](../../development/testing.md) | 体积大的录制 evidence |
| `docs/` | 顶层是 `README.md`（索引）、`getting-started.md` 和 `cli.md`；`tasks/`；`benchmark/`（规则、物理、只用 robot tool 的运行）；`harness/`（总览、Codex、Claude Code、两个适配器、共用登录）；`hosts/`（Mac、Linux、Slurm、Docker、policy environment，以及 `examples/`，每个平台一份起步用的 site TOML）；`runs/`（运行目录、时间、续跑、恢复、evidence 的存放、查看器、操作手册和提示词）；`development/`；`media/readme/`，README 用的图片。每准备一次运行，都会按文件名冻结 `runs/operator-runbook.md`、`development/architecture.md` 和 `development/test-coverage.md` | 生成的文件 |
| `site/` | 项目网页：`index.html`、`DESIGN.md`、`data/`（`tasks.json`、`media.json`、`oracle-videos.json`）和 `assets/`（`atlas/`、`css/`、`img/`、`js/`） | 任务录像和结果，网页从媒体仓库 `RoboTeam-media` 拉取 |
| `docker/` | `roboteam container` 用的 `Dockerfile`，以及 `Dockerfile.dockerignore`，写明从 checkout 构建时排除哪些文件 | |
| `.github/` | `workflows/tests.yml`（离线检查）、`workflows/site.yml`（项目网页）、`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、issue 和 pull request 模板，以及 `prettierrc.json`（JavaScript 文件的格式设置） | |

<a id="folders-not-in-git"></a>
## 不进 Git 的文件夹

| 文件夹 | 放什么 |
| --- | --- |
| `runs/`（或 `paths.runs_root`） | `batches/`（你准备的 batch：冻结的输入、evidence、录下的运动）、`receipts/`（preflight 回执，按 harness 分）、`checks/`（本地检查和物理验证的报告）、`exports/`（停下的 batch 的 collection 及其 ZIP）、`scene-cache/` 和 `asset-cache/`（按内容哈希寻址的缓存）。一次运行的每个文件是做什么的，见[运行目录](../../runs/run-folder.md) |
| `vendor/panda/` | Franka Panda 模型，用 `roboteam bootstrap` 恢复 |
| `benchmark/*/*/assets/` | 场景的网格和贴图，用 `roboteam bootstrap` 恢复 |
| `benchmark/hall/built/` | 运行时加载的厂房，用 `scripts/release/build_hall.py` 构建，用 `roboteam bootstrap` 恢复 |
| `benchmark/hall/meshes/`、`benchmark/hall/textures/` 里生成的文件 | 构建厂房的中间文件 |
| `outputs/` | 构建厂房场景（`roboteam/sim/hall/build.py`）的输出 |
| `site/_media/`、`site/_directions/`、`site/_dev/` | 项目网页在本地编码好的媒体文件，以及设计草稿 |
| `.venv/`、`.venv-gateway/` | `uv sync` 装好的锁定 Python 环境；两个适配器共用的可选环境 |
| `.roboteam/` | 每次运行的 Codex home、preflight 状态和容器记录 |
| `.env` | 凭据，从 `.env.example` 复制 |

克隆仓库不会备份其中任何一个。怎么收集、归档和恢复，见 [evidence 的存放](../../runs/evidence-storage.md)。

<a id="rules"></a>
## 规则

- 发布的场景和它们的公开文件都是冻结的。它们是 `scripts/release/build_release.py` 写出来的，运行时没有任何步骤会重建或修补它们。`benchmark/release.json` 按哈希记下每个文件。
- 共用的材料只存一份。按设计给多个 case 用的文本或文件，比如某种任务类型的指南，只有一份，所有记录都指向它。从某个 case 自己的场景生成的文件留在这个 case 里，哪怕两个 case 生成的字节完全一样：每个 case 文件夹都必须自成一套。
- 运行数据不进 Git。分析代码放在 `roboteam/analysis/`，数据文件夹和输出路径都作为参数传进去。

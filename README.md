<div align="center">

<h1>
<a href="https://changxuanfan.github.io/RoboTeam/">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/wordmark-dark.svg">
<img src="docs/media/readme/wordmark-light.svg" alt="RoboTeam" width="360">
</picture>
</a>
</h1>

**Teams of AI agents run a factory hall of robot arms, in real time, from camera images alone.**

<a href="https://arxiv.org/abs/2611.22138"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/button-paper-dark.svg"><img src="docs/media/readme/button-paper-light.svg" alt="Paper: arXiv 2611.22138" height="36"></picture></a>&nbsp;
<a href="https://changxuanfan.github.io/RoboTeam/"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/button-page-dark.svg"><img src="docs/media/readme/button-page-light.svg" alt="Project page" height="36"></picture></a>&nbsp;
<a href="https://huggingface.co/datasets/RoboTeam-Bench/RoboTeam-Videos"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/button-videos-dark.svg"><img src="docs/media/readme/button-videos-light.svg" alt="Videos on Hugging Face" height="36"></picture></a>&nbsp;
<a href="#license"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/button-license-dark.svg"><img src="docs/media/readme/button-license-light.svg" alt="License: MIT and CC BY 4.0" height="36"></picture></a>

[Jobs](#the-four-jobs) · [Watch](#watch-whole-runs) · [How it works](#how-a-run-works) · [Findings](#what-we-found) · [Quick start](#quick-start) · [Docs](docs/README.md)

<picture>
<source media="(prefers-reduced-motion: reduce)" srcset="docs/media/readme/hero.webp">
<source type="image/avif" srcset="docs/media/readme/hero.avif">
<img src="docs/media/readme/hero.webp" alt="The RoboTeam factory hall from above with its four jobs, Transport, Mosaic, Relay and Dial, then one moment from each job, ending on 28 of 36 tasks finished" width="100%">
</picture>

<picture>
<source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/media/readme/numbers-phone-dark.svg">
<source media="(max-width: 600px)" srcset="docs/media/readme/numbers-phone-light.svg">
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/numbers-dark.svg">
<img src="docs/media/readme/numbers-light.svg" alt="36 tasks in one factory hall; 4 to 16 robot arms on one task; 24 hours of work allowed per task; 28 of 36 tasks finished by the best AI team" width="100%">
</picture>

</div>

## What RoboTeam is

RoboTeam is a simulated factory hall in which teams of AI agents run 4 to 16 robot arms, seeing
only through cameras. It has four jobs, the kinds of work, and 36 tasks: each job with three team
sizes at three levels. It measures how many tasks a team finishes, how long that takes, and its
tokens read, the text a model reads, which sets the cost.

## The four jobs

<table><tr>
<td width="50%" valign="top"><a href="https://changxuanfan.github.io/RoboTeam/#task=transport-large-l3&amp;set=gpt-6.1-sol"><img src="docs/media/readme/transport.webp" alt="Twelve arms deliver items to their boards, at 300 times real time" width="100%"></a><br><b>Transport</b><br>Deliver every item to its place on the right board. Any arm may carry any item, and items cross the table by being handed over or set down for the next arm.<br><sub><b>Arms</b> 4, 8, 12 &nbsp;·&nbsp; <b>Levels</b> flat targets → sockets → sockets on a sprung board</sub><br><sub>Shown: gpt-6.1-sol, 12 arms, 36 items</sub></td>
<td width="50%" valign="top"><a href="https://changxuanfan.github.io/RoboTeam/#task=mosaic-large-l1&amp;set=opus-5.5"><img src="docs/media/readme/mosaic.webp" alt="Eight arms build a picture from 288 cubes, at 300 times real time" width="100%"></a><br><b>Mosaic</b><br>Build a reference picture, one colored cube per cell. The picture has four colors, and every cell needs the right one.<br><sub><b>Arms</b> 4, 6, 8 &nbsp;·&nbsp; <b>Levels</b> pockets → printed lines → unmarked cells</sub><br><sub>Shown: opus-5.5, 8 arms, 288 cubes</sub></td>
</tr></table>
<table><tr>
<td width="50%" valign="top"><a href="https://changxuanfan.github.io/RoboTeam/#task=relay-medium-l3&amp;set=gpt-6.1-sol"><img src="docs/media/readme/relay.webp" alt="Twelve arms pass timbers from arm to arm, at 300 times real time" width="100%"></a><br><b>Relay</b><br>Carry long timbers to the goal. It takes at least two arms to carry one, and each timber must change hands in the air at least once.<br><sub><b>Arms</b> 8, 12, 16 &nbsp;·&nbsp; <b>Levels</b> straight → curved with a hanging weight → hinged with a hanging weight</sub><br><sub>Shown: gpt-6.1-sol, 12 arms, 3 hinged timbers</sub></td>
<td width="50%" valign="top"><a href="https://changxuanfan.github.io/RoboTeam/#task=dial-large-l3&amp;set=gpt-6.1-sol"><img src="docs/media/readme/dial.webp" alt="Sixteen arms turn eight cranks to find a code, at 300 times real time" width="100%"></a><br><b>Dial</b><br>Find a hidden code by turning spring-loaded knobs and holding them all at once. The only hint is a display of the best try so far.<br><sub><b>Arms</b> 4 to 16 &nbsp;·&nbsp; <b>Levels</b> knobs on the table → modules held in the air → cranks</sub><br><sub>Shown: gpt-6.1-sol, 16 arms, 8 cranks</sub></td>
</tr></table>

Each clip opens its whole run on the project page. The [task guide](docs/tasks/README.md) shows
all 36 tasks.

## Watch whole runs

Whole runs at 10× real time, with idle stretches cut. The
[project page](https://changxuanfan.github.io/RoboTeam/#videos) has the runs of every model,
from three cameras.

<table><tr>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/85ab5c04-a60b-4e3f-b364-105a6b39f723" controls muted width="100%"></video><!-- video:transport-1 --><br><sub><b>Transport</b> · opus-5.5 · 12 arms, items set into sockets · 10×, 11:20</sub></td>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/804f16ac-984b-4a7b-98ef-41f686ad29ca" controls muted width="100%"></video><!-- video:mosaic-1 --><br><sub><b>Mosaic</b> · opus-5.5 · 6 arms, 162 cubes, no grid on the table · 10×, 8:56</sub></td>
</tr></table>
<table><tr>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/de8afa7e-a1fb-46e8-9eb6-75f3715b8780" controls muted width="100%"></video><!-- video:relay-2 --><br><sub><b>Relay</b> · opus-5.5 · 12 arms, curved timbers with a hanging weight · 10×, 3:51</sub></td>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/b61e48bd-bd4d-4192-b86e-6c07c43f6ab8" controls muted width="100%"></video><!-- video:dial-1 --><br><sub><b>Dial</b> · gpt-6.1-sol · 16 arms, 8 cranks held in the air · 10×, 4:31</sub></td>
</tr></table>

<details>
<summary><b>Four more runs</b></summary>

&nbsp;

<table><tr>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/06263096-6cc7-4c47-96ba-8815f376f2f5" controls muted width="100%"></video><!-- video:transport-2 --><br><sub><b>Transport</b> · gpt-6.1-sol · 8 arms, items set into sockets · 10×, 9:02</sub></td>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/edf6dfaf-4797-4478-b983-82612114b3a5" controls muted width="100%"></video><!-- video:mosaic-2 --><br><sub><b>Mosaic</b> · gpt-6.1-sol · 4 arms, 72 cubes, no grid on the table · 10×, 5:55</sub></td>
</tr></table>
<table><tr>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/c3e1f49b-aec6-4eaa-abc4-3014f60ad030" controls muted width="100%"></video><!-- video:relay-1 --><br><sub><b>Relay</b> · gpt-6.1-sol · 16 arms, straight timbers · 10×, 2:14</sub></td>
<td width="50%" valign="top"><video src="https://github.com/user-attachments/assets/6b6cfcf8-25e7-4227-8b83-9539a6f82f1d" controls muted width="100%"></video><!-- video:dial-2 --><br><sub><b>Dial</b> · opus-5.5 · 12 arms, 6 cranks held in the air · 10×, 1:46</sub></td>
</tr></table>

</details>

Every file is in the [RoboTeam-Videos dataset](https://huggingface.co/datasets/RoboTeam-Bench/RoboTeam-Videos)
on Hugging Face, where a few runs are marked Coming soon.

## What is new

Earlier benchmarks test agents in a simpler world in three ways. RoboTeam removes all three:

- **Many arms, long tasks.** Most use one or two arms on tasks of minutes. RoboTeam puts 4 to 16
  arms on one task, modeled on real multi-robot work, and a run may last up to 24 hours.
- **A world that never pauses.** Many simulators stop while the agent thinks. In RoboTeam the
  clock keeps running, so slow thinking costs working time.
- **Cameras only.** Many tell the agent where every object is. In RoboTeam, as on a real robot,
  the agents must find out from what they see.

<a href="https://changxuanfan.github.io/RoboTeam/#new">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/compare-dark.svg">
<img src="docs/media/readme/compare-light.svg" alt="RoboTeam against ten other robot benchmarks: every other one has 1 to 4 arms and runs from seconds to at most 4 hours; RoboTeam has 16 arms, runs up to 24 hours, never pauses and gives the agents camera images only" width="100%">
</picture>
</a>

## How a run works

<a href="https://changxuanfan.github.io/RoboTeam/#how">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/how-it-works-dark.svg">
<img src="docs/media/readme/how-it-works-light.svg" alt="How a run works: cameras send pictures, AI agents decide, one robot tool moves the arms, and the clock never stops" width="100%">
</picture>
</a>

- **Real time.** The world moves with the clock and never waits for an agent to think.
- **Cameras only.** Agents get pictures from fixed cameras and the state of their own arms, never
  object positions, depth or contacts.
- **One robot tool.** Move an arm to a pose; open, close or grasp with a gripper.

A team has one of four designs: a Single agent drives every arm; Hierarchical puts a worker on
each arm under a controller; Decentralized gives each arm a worker and no controller; and
Adaptive, the default, has a controller that lends arms to helpers. The
[rules of a run](docs/benchmark/rules.md#a-run-in-six-steps) give its six steps.

## What we found

gpt-6.1-sol finishes 28 of the 36 tasks and opus-5.5 finishes 27; the four other models finish
at most 3. Given the position of every object, the same gpt-6.1-sol finishes all 36.

<a href="https://changxuanfan.github.io/RoboTeam/#results">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/board-dark.svg">
<img src="docs/media/readme/board-light.svg" alt="Tasks finished out of 36, one square per task: gpt-6.1-sol 28 and opus-5.5 27, then kimi-k3.1-pro 3, qwen3.8-flash 1, deepseek-v4.1-flash 1 and glm-5.3-flash 0. opus-5.5 ran in Claude Code, the others in Codex. Given the position of every object, the same gpt-6.1-sol finishes all 36" width="100%">
</picture>
</a>

From camera images, 23% of gpt-6.1-sol's grasps fail, against 0.3% when it is given every
position. With pictures of only 128 × 80 pixels, or without its own code to measure them, it
finishes 14 or 13 tasks instead of 28.

<a href="https://changxuanfan.github.io/RoboTeam/#f-vision">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/vision-dark.svg">
<img src="docs/media/readme/vision-light.svg" alt="Given every position, gpt-6.1-sol finishes 36 tasks and 0.3% of its grasps fail; from sharp camera pictures with its own code, 28 and 23%; from pictures of 128 × 80 pixels, 14 and 41%; without code, 13 and 31%. Beside the chart, one spot of a camera picture at 1280 × 800 and at 128 × 80: one pixel at 128 × 80 is about 14.5 mm, more than twice the 6 mm a cube may be off" width="100%">
</picture>
</a>

The four team designs finish 27 to 29 tasks, but over all 36 tasks Hierarchical reads 3× the
tokens of a Single agent, and a Single agent takes 2× the time of Decentralized.

<a href="https://changxuanfan.github.io/RoboTeam/#f-systems">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/systems-dark.svg">
<img src="docs/media/readme/systems-light.svg" alt="Same score, very different bill: the four team designs of gpt-6.1-sol finish 27 to 29 of 36 tasks. Over all 36 tasks, Single agent takes 407 hours, 2 times the time of Decentralized, and reads 17.1 billion tokens; Hierarchical 204 hours and 51.7 billion, 3 times the tokens of Single agent; Decentralized 199 hours and 45.3 billion; Adaptive 258 hours and 27.0 billion" width="100%">
</picture>
</a>

**More findings**, each with its chart on the project page:

- [The arms mostly wait.](https://changxuanfan.github.io/RoboTeam/#f-time) In one recorded run,
  at least one agent is thinking 90% of the time, but at least one arm moves only 43% of it.
- [Failing and trying again is normal.](https://changxuanfan.github.io/RoboTeam/#f-failure)
  In a typical Relay task of gpt-6.1-sol, every step fails at least once, yet it finishes 8 of
  the 9 Relay tasks.
- [A bigger team is harder than a harder level.](https://changxuanfan.github.io/RoboTeam/#f-levels)
  By level, gpt-6.1-sol finishes 9, 9 and 10 of 12 tasks; by team size, 11, 10 and 7.

Spending more does not buy success: deepseek-v4.1-flash read 25.0 billion tokens and finished
1 task, while gpt-6.1-sol read 27.0 billion and finished 28. No model or team design is yet
fast, cheap and reliable at once. Every chart, with each run to open, is in the
[project page's results](https://changxuanfan.github.io/RoboTeam/#results), and every condition
and number in the [paper](https://arxiv.org/abs/2611.22138).

## Quick start

```sh
git clone https://github.com/changxuanfan/RoboTeam.git && cd RoboTeam
uv sync --locked                                   # Python 3.12 and the locked packages
.venv/bin/roboteam bootstrap                       # the task assets, checked by hash
.venv/bin/roboteam plan --task-types relay --level 1
```

`plan` lists the tasks a batch would run and calls no model, so it is a safe first command. A
real run also needs an account for a model, the pinned Codex or Claude Code command-line program,
and a sandboxed Python environment for the agents.
[Getting started](docs/getting-started.md) goes from a fresh clone to a finished run.

## Documentation

- [Getting started](docs/getting-started.md) and the [command line](docs/cli.md)
- [The tasks](docs/tasks/README.md) and the [rules of a run](docs/benchmark/rules.md)
- [Harnesses and models](docs/harness/README.md): Codex, Claude Code and the models each can run
- Hosts: [Mac](docs/hosts/mac.md), [Linux](docs/hosts/linux.md), [Docker](docs/hosts/docker.md)
  and [Slurm](docs/hosts/slurm.md)
- [Repository layout](docs/development/repository-layout.md): what each folder holds
- [Every guide](docs/README.md) and the [contribution guide](.github/CONTRIBUTING.md)

## Citation

```bibtex
@article{fan2026roboteam,
  title   = {RoboTeam: Benchmarking Vision-Based Multi-Agent Control of
             Many Robot Arms in Real Time},
  author  = {Fan, Changxuan and Xie, Zhongwei and Zhang, Boyi and Hu, Shaoli and
             Xu, Chang and Ren, Xiyu and Li, Yufei and Xiao, Qiao and Jing, Huihao and
             Chung, Kawai and Hu, Wenbin and Luo, Hongyu and Xie, Lingyun and
             Gao, Yisen and Li, Chunyang and Huang, Haoyu and Song, Wuganjing and
             Liu, Yuxuan and Tang, Chiu Yeung and Zhan, Fangneng and Yang, Xi},
  journal = {arXiv preprint arXiv:2611.22138},
  year    = {2026},
  url     = {https://arxiv.org/abs/2611.22138}
}
```

[`CITATION.cff`](CITATION.cff) has the same record.

## License

Code is under the [MIT License](LICENSE). Benchmark data and media are under
[CC BY 4.0](LICENSE-DATA.md), which also lists the third-party material that keeps its own
license.

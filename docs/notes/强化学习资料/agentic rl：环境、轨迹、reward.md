---
title: 'agentic rl：环境、轨迹、reward'
---

## 前言

一个普通的Agent：规划、调用工具、反思、接入记忆了
**为什么需要Agentic RL**：

- agent只是能够让任务跑起来，agentic rl是将一次任务的执行变成训练数据，下一版模型少走弯路
- agent系统能不能做agentic rl训练主要在四点：
  1. Tool Call和环境反馈能不能被完整记录
  2. 历史任务能够在固定版本的环境重新被验证（执行结果一样）
  3. Verifier对过程和结果能够进行判分
  4. 判分的reward能够反过来更新Policy

# Agentic RL训练目标

将强化学习引用到多步交互的Agent任务中，模型根据环境状态学习行动策略

面对的对象：

模型读取Observation -> Action -> Observation直至任务完成
$$
J(\theta)=\mathbb{E}_{\tau\sim\pi_\theta}\left[\sum_{t=0}^{T}\gamma^t r(s_t,a_t)\right]
$$

- 其中θ 是模型参数，πθ 是策略

- γ ∈ [0,1] 是折扣因子
- τ ∼ πθ 表示模型按照当前策略与环境交互；
- sₜ 和 aₜ 分别表示第 t 步的状态与动作；
- 外层的期望 𝔼 表示平均回报

**本节的核心目标主要是解决一下五个问题：**

-  Environment
- Trajectory
- Action Schema
- Reward Engineering
-  Credit Assignment

## 一、 Environment

主要作用就是让Agent可以进行任务的执行和复现

很多人上来就PPO和GRPO，但其实首先应该保证的是Agent可以正确执行的环境

一个环境应该能够保障环境执行：reset、step、judge、replay。这四步

而且一个可以训练的Agent Environment至少需要提供以下四类接口：

1. 从一个确定的初始状态进行执行
2. 可以根据不同的状态选择下一步的action
3. 对trajectory能够正常记录，并且在这个基础上进行打分
4. 在固定的版本中可以重放历史轨迹

**提醒：**还有一个重要的一点，就是同一个task id在固定的历史版本中应该得到（尽量）一致的状态，否则不同的Rollout里面会带来环境偏移带来的影响

## 二、Trajectory（Agentic RL学习的基本单位）

一个Trajectory池至少要纯在三类样本：

- 成功轨迹：模型的行为基准，告诉模型怎么做才是最好的
- 失败轨迹：定义模型的行为边界，告诉模型哪些不好的行为会带来什么样的影响
- 次优轨迹：绕路但是最后正确执行了，Agent在错误中恢复，这个也是很重要

同时还要增加Trajectory的覆盖面：

- 同一个Task，能够对应不同的Trajectory
- 同一个Trajectory，能够对应不同的状态，工具调用，边界条件

这样模型在学习的时候就能学习到不止一种策略，要不然只能一条路走，稍微变一下，模型就不知道怎么进行决策了

下面是一个Trajectory应该保存的一些参数，第一次看肯定记不住，后面多看看:

记忆的方法如下：

记这些字段时，不要把它们当成一堆独立参数，而是按强化学习的一次完整决策流程来记：

**任务 → 状态 → 动作 → 观察 → 奖励 → 结束 → 背景信息 → 训练掩码**

首先一定要有 `task_id / trajectory_id / step_id`，因为必须先知道：这是哪个任务、哪条轨迹、当前走到第几步。

接下来是 `state_digest`。强化学习的核心就是：**模型根据当前状态 State，选择一个动作 Action，希望进入更好的下一个状态。** 所以在执行动作之前，必须知道当前处于什么状态。

有了状态之后，就会执行 `action_type / action_args`，也就是模型这一轮到底决定做什么。例如调用哪个工具、传了什么参数。

动作执行后，环境会返回 `observation`。它表示：**这个动作实际执行以后，环境给模型看到了什么结果。**

接着要记录 `reward_breakdown`。因为强化学习最终要判断：刚才这个动作到底好不好，它对任务产生了多少奖励，各部分奖励分别是多少。

然后记录 `done / terminal_reason`，判断任务是否已经结束；如果结束，还要说明为什么结束，例如任务成功完成、失败、达到最大步数等。

`model_version / tool_version` 属于运行时的背景信息，用来记录当时使用的是哪个模型版本、哪个工具版本，方便之后复现和排查问题。

最后是 `loss_mask`，它和前面的“环境运行过程”不太一样。它决定的是：**这条轨迹里的哪些 token 真正参与 loss 计算、哪些 token 只作为上下文而不训练。**

所以最简单的记忆方式就是：

**先定位是哪一步 → 看当前状态 → 看模型做了什么 → 看环境返回什么 → 看得了多少分 → 看任务结束没有 → 记录运行版本 → 最后决定哪些 token 用来训练。**

```
task_id / trajectory_id / step_id
state_digest                 # 当前状态摘要或状态引用
action_type / action_args    # 动作类型与参数
observation                  # 环境返回
reward_breakdown             # 分项奖励
done / terminal_reason       # 是否结束、为何结束
model_version / tool_version # 策略与工具版本
loss_mask                    # 哪些 token 参与训练
```

**最后比较值得讲的是loss_mask：**

一条Trajectory里面，不可能所有的数据都参与训练，只需要记住，**只有模型参与的决策需要被用来丢进去训练**

因为你的本质就是为了调模型，对模型进行强化训练，所以你只需要记住模型说了什么，至于工具调用的结果，环境信息什么的，通通都不通用参与训练，loss_mask直接等于0就行

也就是说：模型的决策和Tool call需要进行参与训练，模型生成的token就丢进去训练

## 三、Action Schema

历史日志中的工具调用情况直接拿来用会出现一个问题：

动作空间过于凌乱，就比如参考资料里面的一个例子：

```text
search_order(orderId="A123")
order.lookup(id="A123")
getOrderInfo({"order_id": "A123"})
查一下订单 A123
```

上面几部都是用来查找订单id为A123的操作，但是这个训练数据对于了四套动作名，参数格式，模型很难从里面学到稳定的策略，Reply也无法保证重做的结果

所以Tool Call需要经过Schema Adapter的归一化，保证以下稳定：

- 工具名稳定
- 参数类型稳定
- 错误类型稳定
- 版本信息稳定

Schema在参考资料里面也写了，限定系统的安全边界了，定义了模型能做什么，工具粒度还有参数范围

**在工程上需要记录动作的合法和动作的是否成功**：Schema error是模型没有按照协议的要求进行生成，timeout可能工具来自网络。这都表现为工具没有返回想要的内容，但是训练的含义是不一样的，不能都统一写成一个失败的标签

## 四、Reward Engineering

reward设计之前首先需要考虑任务的可验证性：

- 代码任务，数学题，应该通过专门的verifier进行验证
- 半开放任务，比如说写诗啊，写作文这种，引入reward模型

第二个需要考虑的点：

- 如果只在最后给一个reward，成功了是1，失败了是0。这样的情况信号太稀疏了，你一个任务执行失败了，去翻找Trajectory，都不好定位是哪一步做错了
- 还有一种情况就是reward hacking，你执行每一步都会给一个奖励，比如说你读了某一个文件，reward参数+0.1，那么模型可能会出现这样的情况：对同一份文件读十几次，这样reward就能到达1点几了，不断增加reward。模型学到某一步，而一直不推动任务

**reward必须和action带来的环境变化进行绑定**，运行run_test不加reward，但是最后的测试由fail变为success了之后，进行加分

将reward拆分为四层：

- outcome：最后有没有完成，如果完成了reward是1，否则是0

- milestone：执行某一步能够将任务朝着正确的方向推进，有可观察性进展，+0.1

- constraint：如果发生越权，泄露数据，违反业务规则等行为，那么就进行扣分

- cost：重复调用工具，无效的探索扣分

在这里要注意一点，milestone一定是小于outcome的（**过程分是小于终局分的**），比如说milestone一次可能只加0.1，但是outcome完成了就是1。同样cost可能是重复调用工具是-0.1，但是你发生了constraint的行为，比如发生了数据泄露，你让agent帮你把仓库推送到github上，推送的同时给你把.env也放上去了，这种是不能接受的，所以一般要-2这种

可以把一次轨迹的总 Reward 写成：

$$
R(\tau)
=
w_o R_{\text{outcome}}
+
w_m \sum_t R_{\text{milestone},t}
-
w_c \sum_t P_{\text{constraint},t}
-
w_k C(\tau)
$$
`rewardBreakdown` 指的就是这份结构化明细，例如：

```text
{
  "outcome": 1.0,
  "milestone": {"located_target": 0.1, "test_fixed": 0.2},
  "constraint": {"edited_test": 0.0, "permission_violation": 0.0},
  "cost": {"duplicate_calls": 0.05, "tool_steps": 0.03},
  "total": 1.22
}
```

rewardBreakdown用来定位奖励来自于哪里，如果在发现训练曲线的上涨来源于milestone的反复触发，而outcome没有变化，这个时候就要去翻找日志，看看模型是不是在刷分，然后修改一下奖励权重，判重逻辑，还有milestone的判定条件等

## 五、Credit Assignment

这一步主要是将奖励分数还给真正有用的那几步，拿参考资料里面的例子：

```text
step 1: 查到订单                         +0.1
step 2: 使用旧版规则                     -0.5
step 3: 发现矛盾并切换到当前规则         +0.2
step 4: 完成退款                         +1.0
```

最后的reward是0.8，如果平均分配的话，每一步是0.2

但是我们可以明显看到step2使用的是旧版规则，-0.5了，如果我们还在这一步给0.2的话，模型会认为这个是一个正向信号，逐渐变为“先乱查，再补救”这种模型

剩下的就是PPO和GRPO了，详情看：po家族那一节

粗略介绍：

- PPO：先使用Critic估计每一个状态的价值，然后计算TD Error，然后用GAE将未来若干步误差这会当前动作，同时也要使用Clip限制单次更新的幅度
- GRPO：组内赛马，对比与PPO采用的Critic模型，在GRPO中直接放弃了，改为一组数据的平均值作为基线，高于平均值的得到奖励，低于平均值的行为会被抑制。代价也很明确：如果一组 Rollout 全部成功或全部失败，组内方差接近 0，这一组几乎没有学习信号。

怎么选择是使用PPO和GRPO，参考材料里面给了这几种例子：

- **任务较短、终局结果可自动验证、同一任务能采出有分差的多条 Rollout**：优先从 GRPO 起步。代码题、数学推理、短 Tool-use 都比较适合，工程量和显存占用也更低。
- **轨迹很长、不同 Rollout 长度差异大、已经有可信的 Step Reward 或 Milestone Reward**：更适合 Critic-based PPO。Critic 可以对单条轨迹做时间步级估值，不依赖同组轨迹长度一致。
- **组内经常全对或全错**：先调整任务难度、采样温度、Group Size 或 Reward，使组内出现差异；直接继续跑 GRPO 只会得到接近零的 Advantage。
- **只有模糊的终局 Judge，没有稳定 Replay**：先停在 SFT 或 Preference 阶段。此时换 PPO 也无法修复监督信号本身的问题。

# 其他问题（ 训练）

## 一、训练之前数据检查

Agentic数据管线需要检查下面这些内容（引用参考资料内容，这块儿纯八股了）：

- **轨迹是否完整。** 要保留 State、Action、Observation、Reward 和 Terminal Reason，成功、失败、次优三类轨迹都要有；只存最终回复或单个 Tool Call，后续无法做 Credit Assignment。
- **环境是否稳定。** Tool Schema、规则文档、数据库快照和 Verifier 都要版本化；固定任务能否 Replay，Replay 后 Reward 是否一致，要在训练前先验收。
- **数据是否隔离。** 训练集和测试集不能共享任务模板、环境状态、Gold Patch、隐藏规则或 Verifier 脚本。PII、密钥、租户数据要在进入 Trajectory Store前脱敏。
- **探索是否有覆盖。** 同一任务要包含不同描述、初始状态、错误返回和恢复路径。轨迹池若只含教师模型的一种做法，RL 很容易退化成对教师路径的继续模仿。
- **质量是否可解释。** 每条轨迹要能回答得分从哪里来、哪一步触发约束、哪个工具调用增加成本。低质量数据堆得越多，模型越容易把偶然行为学成固定模式。

## 二、训练路线（感觉看参考资料有点像从0开始了）

训练路线一般分为三步，之后需要replay进行验收：

- sft
- preference学习
- Oline Rl

### 首先先讲sft（冷启动）

因为很少一开始就对一个模型进行Oline RL，我们轨迹池里面之前讲了，保存了很多轨迹，那么在SFT阶段，我们需要做的就是，将好的轨迹交给模型，让模型值得怎么做，专家轨迹教会他Tool Schema、任务流程等。

同时Trajectory里面还保存着纠错再做对的轨迹，把错误的片段，进行loss_mask掉，这样模型技能看到错误后的环境状态，也能学习后续的动作，并且不会模仿错误的action

### preference学习

上一步教会了模型怎么做，这一步主要是教会模型具备优劣判断，有点类似于DPO的方法，在DPO中，选择了，chosen/rejected对，进行对比学习，在这一步也同理，通过构造成功轨迹/失败轨迹，让模型进行对比学习，从而能使模型对轨迹的优劣进行判断

### Oline RL

这一步主要是让当前策略持续rollout，再利用环境反馈进行优化
进行Oline RL之前需要之前需要明确一下几个问题（offline rl，replay）：

- sft是教会模型怎么做，preference是教会模型哪个更好，Oline RL则是让模型自己学会纠错，自己尝试
- 在尝试之前需要进行**offline RL**训练：这一步的目的主要是因为online RL训练太贵了，而且弱模型一开始大部分都是垃圾轨迹，所以先使用offline rl把基本能力训练出来比较好
  **怎么做：**
  - 数据主要来自就的policy，off-policy训练，先给模型看一大批observation-action-observation这种，调用工具，下一个状态，再调用工具得到下一个状态。模型主要学习的是在某一个状态我下一步该采用哪一步动作，缺点就是有些action在数据里面不会出现，会受到off-policy分布偏差限制

### Replay

这个和上面是同等重要的。

举一个例子，比如说：订单退款的事情，用户发起订单退款，下一步是查询退款规则（v1），发现符合规则，进行退款，退款成功，reward=1

但是隔了一段时间，很可能是一个月了之后，公司业务发生了变化，用户再次发起了退款，查找退款规则（v2），这个时候的规则已经变为了v2了，那么不进行退款，退款失败，reward=-1.

replay失败？

所以你光保存observation+action是不够的，之前讲过**replay是为了防止环境偏移带来的误差，Replay = 把以前的一条轨迹，尽量放回“当时那个环境”里重新跑一遍，看它还能不能得到同样的结果和 Reward。**

所以它需要保存以下信息（来自参考资料）：

```text
model_version
tool_version
policy_doc_snapshot
db_snapshot
sampling_params
random_seed
reward_breakdown
policy_version_at_rollout
environment_version
```

当出现问题了之后，同一条轨迹的reward不同，可以对上面的信息进行逐项排查

同时还有一个点，**replay是连接offline和online的训练桥梁**：
因为你的offline是已经知道了好坏的历史样本了：
比如说进行订单查询的例子：

1. 成功的轨迹：reward+1
2. 失败的轨迹：reward-1
3. 次优轨迹：reward+0.7

但是你进行replay结束后，得到的结果是

1. 成功的轨迹：reward+0.6
2. 失败的轨迹：reward+0.5
3. 次优轨迹：reward+0.4

很明显出现了问题，这个时候在上线，进行Oline RL，模型会有偏好失败轨迹的倾向

### Agent Rollout需要异步

Agent Rollout在执行一次采样的时候，因为reasoning rl是生成了一段文本就能直接判分，可以一直占用gpu，但是Agent Rollout需要和外部环境进行交互，可能会遇到网络时延，工具执行等问题，短的30几秒，长的几十分钟，如果不加以利用，gpu就会出现空转的情况，等待工具调用的完成

长见的训练方式：Rollout采样出一批Trajectory，统一计算reward，通过reward对policy进行优化，更新权重，进行下一批Rollout。这种情况下，第一步Rollout的时间取决于最长的Trajectory。

为了解决上述情况，所以Agent Rollout需要进行异步处理，将Rollout和Trainer系统分开，Rollout不断采样Trajectory，Trainer根据已经采样好的Trajectory进行训练，然后通过weigh sync actor定期将参数推送给节点

由此引出了几个问题：

- **我的一条Trajectory，前面是用的参数v1，后面你把节点的参数更新了，policy版本我使用了v2了，一条Trajectory又不同参数的policy生成怎么解决？**
- **参数很多，你推送过去的时间也需要很多，当你推送过去了，本来是应该有v2版本的policy生成的Trajectory，你是由v1生成的，怎么解决？**

等等问题，下面一一介绍

### Policy Staleness

问题：**Oline RL是on-policy模式，当你的节点已经推送更新了，比如说你的policy版本是v5，但是后面训练的数据还是通过policy版本为v3的版本，这样就会变为off-policy模式**

对此引入解决办法：计算在同一个状态下，新的policy对这个Action/Token的概率差异有多大
$$
\rho_t=\frac{\pi_{\text{current}}(a_t\mid s_t)}
{\pi_{\text{rollout}}(a_t\mid s_t)}
$$
如果偏离的过大，直接选着丢弃

第二步：Importance Sampling：还是依旧与上面的比率有关系，用这个ratio给旧数据进行加权，如果做Truncated IS（Truncated Importance Sampling），并设\[ \rho_{\max}=2 \]，那么\(\bar\rho=\min(\rho,\rho_{\max})\)

，这样你原始的`ρ = 20`，你设 `ρ_max = 2`，那训练时就按 **2** 来加权，而不是按 20。目的就是防止旧策略采出来的少数样本，因为新旧策略概率差异太大而把梯度放得过大、导致训练不稳定。

**难点：**我开始学习这里的时候就在想，差异大直接丢啊，比例都到了20了，为什么还不丢。其实主要还是没有搞清楚粒度问题：如果整条Trajectory太久了，那么可以直接丢弃，但是比如一条 Trajectory 有 100 个 token，其中 99 个的 ratio 都在 `0.8~1.5`，只有 1 个 token 的 `ρ=20`。如果你看到 20 就把整条 Trajectory 丢掉，会把前面 99 个仍然有价值的数据也浪费掉。

所以：**“丢弃”通常针对整条 Trajectory 太旧；Truncated IS 针对其中某个 token/action 的比率太大。两者粒度不同。**

### Partial Rollout

这个就是上面讲的那个问题：
**一条Trajectory，前面是用的参数v1，后面你把节点的参数更新了，policy版本我使用了v2了，一条Trajectory又不同参数的policy生成怎么解决？**

做法：第一个选择继续用原参数跑完，第二个选择就是后半段采用新的参数

通常选择：
```
v100 生成了一部分
        ↓
新权重到达
        ↓
中止当前生成
        ↓
保存已经生成的 prefix
        ↓
记录版本边界
```

Trainer 可以决定前半段继续训练、分段训练，或者直接丢弃。

```
哪些 Token 可以算 Loss
每个 Token 是哪个 Policy 生成的
哪些 Token 已经失效
```

### Train–Inference Mismatch(感觉涉及到了infra的知识看不懂)

**MoE Router = 给每个 Token 决定“这一层该交给哪些 Expert 处理”的小网络。**
简单来说就是Rollout使用的推理引擎和训练使用的推理引擎不一样，比如Rollout使用SGLang，vllm这种，训练使用FSDP，然后就会导致精度，kernel不一样，从而导致MoE Router不一样，这样的结果就是即使是同一份权重，两段算出的Token Logprob也会出现偏差，PPO/GRPO 的 probability ratio 出现假变化。MoE 中还可能导致 Router 选到不同 Expert，误差被进一步放大，所以解决方法是Router Replay 固定 Expert 选择，但重新计算 gating weight，保留 Router 梯度

### Weight Sync（将参数传给Rollout节点：万恶之源）

**Importance Sampling = 重要性采样。它的本质是：数据是旧策略采出来的，但你想拿它来估计当前策略的效果，所以用一个概率比率给样本重新加权。**
问题：Trainer得到更新的版本了之后，需要将参数传递给Rollout节点，逐个Tensor传会造成大量的通信的启动开销。切换时刻的选择，如果一个quest，前一段读取的是v1版本，同步发生，后几层读取的是v2版本。最后Importance Samping是没有意义的，因为**真实生成这个 Token 的 Policy 根本不存在一个明确版本。**(可以用上面的partial rollout解决)

正确的流程：
```
暂停接新请求
    ↓
处理 / 中止正在运行的 Rollout
    ↓
清掉旧 KV-cache
    ↓
同步 v101 权重
    ↓
检查同步完成
    ↓
policy_version = 101
    ↓
恢复生成
```

### 评估（直接复制粘贴参考资料了，感觉像是8股）

不能只看pass rate

五层指标评估：

1. **Task Outcome**：Pass Rate、Resolved Rate、最终答案正确率；
2. **Action Quality**：Tool Schema 合法率、无效动作率、重复调用率、恢复成功率；
3. **Efficiency**：平均步数、Token、工具费用、Wall-clock Time、超时率；
4. **Safety & Constraint**：越权率、敏感信息泄漏、修改测试、非法网络访问；
5. **Replay & Audit**：轨迹重放成功率、Reward 复算一致率、环境失败占比、Judge 稳定性。

同时你的Agentic RL还需要回答：

- **可执行性**：Action Schema 是否统一，环境能否稳定重放；
- **可判分性**：Reward 来自测试、规则、Rubric、Reward Model 还是人工；
- **可解释性**：能否从 Reward Breakdown 和 Trace 中定位模型在刷什么、错在哪里。

Verifier也要自己接受评估，确定性检查啥的，测试编译。开放任务再引入LLM Judge

# 参考资料

- [(59 封私信 / 22 条消息) Agentic RL 系列（上）：环境、轨迹、Reward 与训练闭环 - 知乎](https://zhuanlan.zhihu.com/p/2070106530058392520)

- [verl Agentic RL Training](https://link.zhihu.com/?target=https%3A//github.com/volcengine/verl/blob/main/docs/start/agentic_rl.rst)
- [Awesome Long-Horizon Agents](https://link.zhihu.com/?target=https%3A//github.com/RUC-NLPIR/Awesome-Long-Horizon-Agents)
- [Hello-Agents 第十一章：Agentic-RL](https://link.zhihu.com/?target=https%3A//github.com/datawhalechina/hello-agents/blob/main/docs/chapter11/Chapter11-Agentic-RL.md)
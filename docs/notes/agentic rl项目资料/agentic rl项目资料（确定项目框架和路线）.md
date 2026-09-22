# Agentic RL 项目资料（确定项目框架和路线）

> 上传时间：2026-09-22 09:18（北京时间，UTC+8）

## 一、名词解释

- vLLM：高性能大模型推理引擎比如 Agent 说“我要让 Qwen3.5-9B 回答这个 prompt”，真正把模型放到 GPU 上并高速生成 token 的可以是 vLLM。它主要负责**生成答案，不负责训练模型**。在 verl 中，vLLM 也是官方支持的 rollout 推理后端。

- verl：大模型强化学习训练框架。 它拿到 `prompt + 模型回答 + reward` 等训练数据后，执行 PPO/GRPO 一类 RL 算法，反向传播并**更新模型参数**。所以可以粗略记成：**vLLM 负责“答题”，verl 负责“根据分数学习”。** Agent Lightning 的 Trainer 就建立在 verl 的训练配置之上。

- Gateway：**网关/中间代理。** Agent 不直接请求 vLLM，而是请求 Gateway；Gateway 再把模型请求转过去，同时把 `prompt、response、log_probs` 等 RL 需要的数据截获下来。Agent Lightning 默认的 `agl-server` 就是这个 API Gateway。

- **Controller = Agent 执行调度器。** 它决定“现在启动哪些 Agent、让它们执行哪些任务”，可以直接在本机启动，也可以创建 Kubernetes Job。它不是控制模型如何生成 token，而是控制**哪些 Agent 任务被执行**
- **rollout = 模型实际跑一次任务产生的完整交互过程。** 例如给 Coding Agent 一个 GitHub issue，它经历 `读问题 → LLM 思考 → 搜代码 → LLM 再思考 → 修改代码 → 跑测试 → 得到 reward`，这一整趟就是一个 rollout。一个 rollout 里可以包含很多次 LLM 调用；Agent Lightning 会把 Gateway 收集的这些调用进一步整理成 verl 的训练样本。

## 二、项目架构

```
Agent
   │
   │ POST /v1/chat/completions
   ▼
LLMProxy / API Gateway :8080
   │
   │ ① 记下来：
   │   “MewCode 问了什么”
   │   “模型回答了什么”
   │   “生成了哪些 token”
   │   “对应 log probability 是多少”
   │
   │ ② 转发请求
   ▼
vLLM
   │
   │ 加载并运行
   ▼
Qwen
   │
   │ 在 GPU 上算出下一个 token
   ▼
vLLM
   │
   ▼
LLMProxy
   │
   ▼
Agent
```

 **LLMProxy**：类似一个带训练记录的中转站，相当于上面的Gateway

## 三、技术路线

自己设计的coding agent+verl+vLLM+QWen+SWE-reBench
**工作：**

1. Trajectory + Rollout系统：`Agent.run()`，不是只保存聊天记录，而是记录每一步 `state → assistant tokens → tool action → tool result → token logprob → reward`，同时解决 multi-turn trajectory 拼接、assistant token loss mask、tool observation 不参与 loss、超长 trajectory 截断等问题。
2. 研究一下step-level credit assignment，如果实在不行的，只能采用vanilla GRPO，tess  pass = 1问题

verl+vLLM+QWen+SWE-reBench这些都是用开源的

然后做实验，证明我这个是对的：
我的第一个点工作肯定是要做的，而且还要做懂，有含金量的是第二个点

做第一版基线：
agent trajectory、patch、swe tests、reward采用vanilla GRPO，tess  pass = 1

然后再细化：因为一个coding agent可能有30多个action，但是最终的reward只有一个0或者1，GRPO知道整条trajectory好不好，但是不知道某一步的工具调用是否有用
所以研究Step-level Credit Assignment，研究每一步的action活的的credit

线路如下：

```
Terminal Reward
       ↓
Execution Feedback(成功失败，调用工具成功/失败，pytest结果？)
       ↓
Step-level Credit Assignment（这些结果该归功于谁）
       ↓
每个关键 Agent Action 获得不同 credit
       ↓
Token / Action Advantage
       ↓
GRPO update
```

研究的问题：

**这些 credit 怎么算？怎么避免 reward hacking？怎么把 step reward 转换成 advantage？检索行为的 credit 应不应该传播给后续 Edit？失败但提供有用信息的 Bash action 应不应该得到正 credit？**

**Vanilla GRPO vs  Step Credit 方法**

| Method                 | Resolve Rate | Avg Steps | Invalid Tool | Test Calls |  Token   |
| ---------------------- | ------------ | --------- | ------------ | ---------- | :------: |
| Qwen Base              | 实测         | 实测      | 实测         | 实测       |   实测   |
| Vanilla GRPO           | 实测         | 实测      | 实测         | 实测       |   实测   |
| **GRPO + Step Credit** | **实测**     | **实测**  | **实测**     | **实测**   | **实测** |

## 四、强化学习的一些名词

- on-policy：用当前策略 $\pi$ 自己采样的数据，再更新这个 $\pi$。也就是
  **当前策略采样 → 当前策略学习**。
  （A采完样了之后，A用这些数据学习）
- off-polic：采样数据的策略 $\mu$ 可以和要学习的目标策略 $\pi$ 不一样。也就是
  **行为策略 $\mu$ 采样 → 目标策略 $\pi$ 学习**。
  （也就是A负责采用，B从A的经历里面学）
- Value-based 先学“哪个动作值钱”，再选动作；
- Policy-based 直接学“在这个状态下该选哪个动作”。




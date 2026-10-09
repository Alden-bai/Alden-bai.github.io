## 前言

之前已经有了很多的专家轨迹了，需要让模型记住到某一步了，我下一步应该怎么做，解决模型的失忆问题。

例子：

我需要完成一个任务，需要跑20步，中间有很多弯弯绕绕，比如：a-b-c这种

从新做一个任务的时候，有需要从头开始，所以需要将历史的轨迹存进外部的memory，遇到相似的任务时检索回来。但是检索回来的也是一堆探索，回退，工具报错，观察这种流水账。

所以skillrl是将经验进行抽象化，将历史轨迹蒸馏出可以复用的skill

## 例子

```
名称：出发前检查关键物品

原则：
执行一个离开当前位置、之后难以返回的任务前，
先确认后续必需物品是否已经随身携带。

适用条件：
即将离开办公室、酒店、车辆等地点，
并且后续任务依赖钥匙、证件、手机等关键物品。

行动：
出发前检查：
钥匙 → 手机 → 钱包/证件。
缺少关键物品时，先补齐再离开。
```

## 四步流程

### 一、成功的轨迹将方法提取出来，失败的轨迹将教训提取出来

- 对于成功的轨迹，需要收集这条线路为什么可以成功，以及哪些决策可以迁移到类似任务

- 对于失败的轨迹，需要收集哪一步出错，当时选了什么错误的动作，什么是正确的动作，以后遇到类似的情况怎么避免

优点：原轨迹可能有几十步，经过teacher蒸馏后只会留下几条高密度规则，所以检索时更省上下文，同时失败的轨迹也利用起来了，作为下次不要再犯的显示经验

缺点：skil的质量对teacher model的依赖性很强，如果teacher理解错了，将某次偶然事件总结为规律或者错误判断原因失败，存入了一条错误的经验。

### 二、两级Skill bank管理经验

- 第一级：General skill，通用经验，大家都能使用的
- 第二季：task-specific skill，针对某类任务的操作经验

每条skill应该包含名称，原则和使用条件

在使用时，通用skill直接注入，task-specific skill在注入时，这里使用了rag的知识，首先是将问题进行embedding，然后和task-specific skill进行一个相似度检测
$$
\mathrm{SkillBank} = S_g \cup \bigcup_{k=1}^{K} S_k
$$

$$
S_{\mathrm{ret}} = \operatorname{TopK}\left(\{s \in S_k : \operatorname{sim}(e_d,e_s) > \delta\}, K\right)
$$

这里的sim是计算相似度，有一个δ阈值，相似度大于阈值的前k条

分层的原因：只使用通用skill的话，规则太广泛，只使用task-specific skil的话，会丢失很多通用skill的能力

### 三、冷启动微调（cold-start SFT）

有了skill bank，但是基模不一定会用，毕竟skill只是提示词方面的。所以需要先在正式的rl前做一次sft，看到skill，理解skill，在合适的时机调用skill这个行为交给模型

\[ \mathcal D_{\text{SFT}} = \{(d_i,S_i,\tau_i^*)\}_{i=1}^{N} \]

di：第i个任务的描述

si：检索出的skill

\(\tau_i^*\) = Teacher 在参考这些 Skill 后给出的正确执行轨迹。

Teacher会先生成一批带skill的示范轨迹用来学习

然后用普通监督微调来训练

### 四、GRPO更新策略的同时，更新skill bank

GRPO计算组内归一化Advantage：
$$
A_i = \frac{R_i - \operatorname{mean}(R_1,\ldots,R_G)}
{\operatorname{std}(R_1,\ldots,R_G)}
$$
然后计算**同一个 Skill 条件**下，对同一条轨迹 \(\tau^{(i)}\) 的概率比：
$$
\rho_i =
\frac{
\pi_{\theta}\left(\tau^{(i)} \mid d, S_g, S_{\mathrm{ret}}\right)
}{
\pi_{\mathrm{old}}\left(\tau^{(i)} \mid d, S_g, S_{\mathrm{ret}}\right)
}
$$
\(\rho_i\) 衡量的是“在相同 Skill 提示下，策略更新前后对这条轨迹的偏好变化

SkillRL更新通常是在validation epoch之后，先找到失败的任务，提取失败任务的轨迹，交个teacher分析，然后更新新的skill放入skill bank中，然后进行下一轮RL

## skillrl的工程边界

1. teacher成本高。轨迹蒸馏和分析严重依赖模型

2. skillbank可能会无限增长。skill冲突，重复规则等

3. reward只评价整条轨迹，没有继续分配到每条skill。一条轨迹可能会使用6条skill，系统很难判断成功是哪条skill带来的，也无法区分失败是来自策略本身还是检索的结果，还是skill的误导

4. skill提炼器（teacher）并没有参与reward的端到端训练，teacher是否能提升相关任务，需要后续执行阶段才能验证：
   \[ \text{失败轨迹} \rightarrow \text{Teacher} \rightarrow \text{生成 Skill} \]

   \[ \text{Skill} \rightarrow \text{Solver 执行任务} \rightarrow \text{得到 Reward} \]

   第二条链中的reward并不会反向传播更新teacher


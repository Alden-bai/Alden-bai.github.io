## 前言

skillRL中，并不会将skill的生成列入强化学习中，所以说并不能保证提炼出的skil有用

evolving-rl主要是将skill的生成也纳入强化学习，提炼出的skill要在下游任务接受检验，同时更新extractor和solver

- extractor：读取任务，轨迹，环境奖励，生成skill

- solver：读取下游任务和skill，生成行动轨迹

## skill的提炼和skill的执行不能分开的原因

两点原因：

1. 先进行提取skill，然后再通过RL训练目标模型。solver做完任务reward只更新solver自己的参数，而不告诉extractor哪条skill有帮助
2. skill有噪声时候，solver为了获得稳定的reward，会降低对skill的依赖，extractor收不到这些反馈，最后会出现，solver看到skill选择忽略，extractor继续生成一大堆垃圾skill

## 过程

extractor和solver共用同一套参数**θ**，模型既学习怎么样写出可以迁移的专家经验，又学习怎么使用和拒绝经验

### 一、先完成一波原始任务

先不注入skill，solver直接和环境进行交互，得到完整的轨迹和奖励，得到完整的轨迹和环境奖励r

将任务，轨迹和奖励一起合并构造extration state：
$$
s^e = \left(x^{\mathrm{src}}, \tau, r^{\mathrm{src}}\right)
$$
extractor通过这些来区分哪些动作成功，哪些失败，哪些没有完成

### 二、同一条轨迹生成N个候选的skill

Extractor从同一个extraction state里面采样N条候选skill

采样N条的原因：
extractor没有唯一标准的答案，同一个经验可以写成不同粒度，不同措辞的表述

### 三、用同一组下游任务检验每一条skill

首先先将源任务描述转化为embedding，然后检索k个语义相关的任务：
$$
\mathcal{X}^{\mathrm{ret}} = \mathcal{R}(x^{\mathrm{src}})
= \operatorname{TopK}_{x \in \mathcal{D}}
\, s\left(\phi(x^{\mathrm{src}}), \phi(x)\right)
$$
例如：

源任务：从冰箱拿鸡蛋

检索到的任务：从冰箱拿水，从抽屉拿书等

然后将每一个skill和每一个固定的下游测试任务组合，做一次Rollout
$$
t_{ij} \sim \pi_{\theta}\left(\cdot \mid x_j, e_i\right)
$$
最后计算每一个候选skill在k个任务上的平均表现：
$$
R_i^e = \frac{1}{K}\sum_{j=1}^{K} r_{ij}
$$
较高的extractor reward对于的skill是较好的skill，reward低的skill是比较差的skill

### 四、训练

对extractor和solver一起训练

- extractor：哪条skill的迁移能力更强
- solver：区分好、坏skill

#### extractor

N个skill构成一个GRPO的组，进行组内归一化计算Advantage：
$$
A_i^e =
\frac{
R_i^e - \operatorname{mean}\left(R_1^e,\ldots,R_N^e\right)
}{
\operatorname{std}\left(R_1^e,\ldots,R_N^e\right)
}
$$
后面就是传统的GRPO了，clip，然后提高出现好的skill出现的概率，降低坏的skill出现的概率

损失函数不看了，太复杂了，后面就是传统的GRPO过程，搞清楚Advantage怎算的就行了我觉得

#### solver

\(r_{ij}\) ：**第 \(i\) 条 Skill 用在第 \(j\) 个下游任务上时，Solver 得到的任务奖励。**
$$
A_{ij}^{s} =
\frac{
r_{ij} - \operatorname{mean}\left(r_{1j}, \ldots, r_{Nj}\right)
}{
\operatorname{std}\left(r_{1j}, \ldots, r_{Nj}\right)
}
$$
损失函数太复杂了，不看了
$$
\mathcal{L}_s(\theta)
=
-\frac{1}{NK}
\sum_{j=1}^{K}
\sum_{i=1}^{N}
\min\left(
\rho_{ij}^{s} A_{ij}^{s},
\operatorname{clip}\left(\rho_{ij}^{s}, 1-\epsilon, 1+\epsilon\right) A_{ij}^{s}
\right)
+
\beta_s D_{\mathrm{KL}}\left(\pi_{\theta}\,\|\,\pi_{\mathrm{ref}}\right)
$$
当skill有效是，solver会使用它超过其他的skill，skill效果差的时候，会对将其出现的概率拉低

### 更新

将两个Loss进行加权求和，这样不仅能够使这个模型以后生成更好的skill，同时还能使这个模型学会如何使用skill，区分好坏skill
$$
\mathcal{L} = \lambda_e \mathcal{L}_e + \lambda_s \mathcal{L}_s
$$

## skillRL和evolving-rl的区别

skillRL中的skill有teacher生成，GRPO再训练策略，teacher不参与reward更新

evolvin-rl：同时担任extractor和solver，跨任务reward评价候选skill，联合更新两种能力

## 代价

1. Rollout的数量变多，N个skill和K个任务，有NxK个轨迹，训练成本高

2. skill reward依然带有噪声。任务难度，环境随机性都会影响skill ei的奖励

3. extractor和solver会互相影响。Extractor 希望学出“稳定、通用”的 Skill，Solver 希望学会“具体情况下怎么行动”。如果两个 loss 的权重、KL、熵没调好，就可能出现一边变好、另一边变差。

4. 语义相似并不代表可以迁移。Retriever 用 embedding 找“描述上相似”的任务，但描述相似的两个任务，真实策略可能完全不同。

   ```
   “登录网站并修改设置”
   “登录网站并删除账号”
   ```

   语义接近，但是关键操作不一样
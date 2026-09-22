# PO 家族（PPO、DPO、GRPO）

> 上传时间：2026-09-22 09:18（北京时间，UTC+8）

## 前言

SFT只是模仿，模型知道“1+1=2”，也知道“一加一等于二”。但是 SFT 无法告诉模型哪一个更好。

你问一下大模型，大模型能蹦出一堆答案给你，都是对的，但是不知道哪个好，此时就需要注入一些偏好，这个时候就引入强化学习

**强化学习本质：对齐你想要的意图**

比如说你问大模型，他给你四段回答：

1. 热情开朗
2. 严肃认真
3. 嬉皮笑脸

3个答案都是对的，但是对于数学题来说，我们可能更需要严肃认真的语言模式，对于情感安慰来说，我们更需要热情开朗的，所以说**它不定义什么是绝对的好，它只负责把模型变成你心中想要的样子。**

## PPO

重点是四个模型：

- actor（主角，需要更新参数）

  > 负责根据问题生成答案，也就是策略模型 \(\pi_\theta\)，负责真正输出 token。

- critic（需要更新参数）

  > 预测当前状态的价值 \(V(s_t)\)，即“从现在继续生成，预计最终能拿多少回报”。然后 `reward + V(s_t)` 再通过 GAE 算出 Advantage。

- reward（冻结参数）

  > 对**完整回答**给一个整体偏好分，例如整段回答得 8 分。之后这个 reward 会参与计算各步 Advantage。

- reference model（冻结参数）

  > 防止模型跑偏，提供参考概率，与 Actor 计算 KL 散度，限制 Actor 偏离原 SFT 模型太远。

一次PPO的执行过程：

1. 输入问题
2. actor根据问题生成答案
3. 计算reward
4. critic计算每一个token状态的V(st)
5. 通过V（st）+reward来计算advantage
6. PPO根据GAE算的advantage来更新actor
7. clip防止更新的变动太大
8. 下一轮

**Advantage：实际结果—预期结果**

PPO公式：
	\(L^{CLIP}(\theta) = \mathbb E \left[ \min \left( r_t(\theta)A_t,\; clip(r_t(\theta),1-\epsilon,1+\epsilon)A_t \right) \right]\)

其实也不难理解：

- r：改了多少

  > \(r_t(\theta) = \frac{ \pi_\theta(a_t|s_t) }{ \pi_{\theta_{old}}(a_t|s_t) }\)
  >
  > 旧actor生成某个token的概率是0.2，新actor生成的概率变为了0.4
  >
  > 那么0.4/0.2= 2，这个token生成的概率是以前的两倍了

- A：往哪个方向改

- clip：一次不能改太猛

  > 步子迈的太大容易把模型训崩，上面的那个例子一次更新直接增加了200%
  >
  > 但是我们的PPO设置的\(\epsilon=0.2\)
  >
  > 所以\(r\in[0.8,1.2]\)
  >
  > 变化的概率不能超过20%

PPO的缺点就是一次需要加载4个模型，非常吃显存

## DPO

对于PPO来说，就是砍掉了reward还有critic这两个模型

对于同一个问题，有两个答案，选择一个，此后遇到这种问题，chosen的概率要比reject的答案要高很多，有点像成对对比学习

只有两个模型：

- actor（参数会更新）

  > 离chosen答案越来越近，离reject答案越来越远

- reference（冻结参数）

  > 理解为actor在DPO之前的版本，主要是用来回答训练了之后actor，对比自己改变了多少
  >
  > 目的：防止 Actor 为了迎合偏好数据改得太夸张，用来给actor进行参考

DPO的公式：
\(L_{\text{DPO}} = -\log \sigma \left( \beta \log \frac{\pi_\theta(y_w)} {\pi_{\text{ref}}(y_w)} - \beta \log \frac{\pi_\theta(y_l)} {\pi_{\text{ref}}(y_l)} \right)\)

看着吓人，其实就回答了两个问题：好答案相对于reference提高了多少，坏答案相对于reference降低了多少

最大化“好答案相对于基座模型的提升量 - 坏答案相对于基座模型的提升量”

yw是好答案，yl是坏答案（win和lose）

\[ \frac{\pi_\theta(y_w)} {\pi_{\text{ref}}(y_w)} \]：比如之前的actor生成好答案的概率是10%，新actor模型生成好答案的概率是20%，那么0.2/0.1=2

\[ \frac{\pi_\theta(y_l)} {\pi_{\text{ref}}(y_l)} \]:比如之前的actor生成坏答案的概率是20%，新actor模型生成坏答案的概率是10%，那么0.1/0.2=0.5

最后log做减法，这个值越大越好

sigmoid函数主要是将这个数映射到0-1之间，加入这个例子里面最后计算的sigmoid是0.8，那么我可以认为我选择chosen的这个答案的概率是0.8

DPO比PPO简单，少了两个模型，但是需要准备大量的依赖的标注数据，需要高质量的chosen/rejected偏好数据

## GRPO（组内赛马）

一句话概括就是：同一道题让模型生成多个答案，不引入critic来评判这个答案生成的有多好，而是通过组内相互打分，组内打分的平均值作为基线，这一组答案中，高于平均值的被鼓励，低于平均值的被压低

GRPO的advantage公式：
\(A_i= \frac{ r_i-\operatorname{mean}(r_{\text{group}}) }{ \operatorname{std}(r_{\text{group}})+\epsilon }\)

std是标准差，将不同题目的奖励尺度统一一下，[1,0,0,0]和[60,20,10,10]这种，尺度就不一样，需要统一一下

算完advantage了之后，剩下的就是PPO的流程了

PO 得到组内 Advantage 后，本质上像一个“省去了 Critic 的 PPO”，并继续保留 PPO 的 clipping。

还是比较新的actor对于旧actor，回答的概率改变了多少，

**保留reference的原因**：和PPO一样，可以为了奖励改变actor，但是不要离原来大模型太远

流程：
```
Prompt
  ↓
Actor
  ↓
同一道题生成 G 个回答
  ↓
每个回答获得 Reward
  ↓
计算组内 mean 和 std
  ↓
A_i = (自己的 Reward - 组平均 Reward) / std
  ↓
A > 0 → 鼓励
A < 0 → 压低
  ↓
PPO Clip
限制策略一次更新太猛
  ↓
Reference Model + KL
防止 Actor 跑偏
  ↓
更新 Actor
```

问题：大家全错了，GRPO就很难在这一组里面学到东西了，还有虽然省掉了critic，但是actor的采样量增加了，以前的actor可能只需要生成一个答案，现在GRPO一个问题需要生成8个甚至更多的答案，增加了采样/推理成本

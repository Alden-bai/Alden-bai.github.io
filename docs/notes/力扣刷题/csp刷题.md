---
title: CSP 刷题
---

# 真题刷题

## [**CSP202506A**  正态分布](https://oj.shumeng.tech/p/CSP202506A)

```c++
#include <bits/stdc++.h>

using namespace std;

int main(){
    int k;
    cin >> k;

    for(int i = 0; i < k; i ++ ){
        int u, sigma, n;
        cin >> u >> sigma >> n;

        int ans = (n - u) * 100 / sigma;

        int row = ans / 10 + 1;
        int col = ans % 10 + 1;

        cout << row << ' ' << col << endl;
    }

    return 0;
}
```

代码比较简单，这道题我在考场上的时候全过了，但是用考场上的代码在oj平台评测时只过了9个，很奇怪  

这道题应该使用*100的方法来做，扩大100倍，注意**浮点数反复减0.01会有误差**所以说我之前的代码不行，只能用扩大100倍来做，因为表格是按照0.01划分的

## [**CSP202506B**  机器人复健指南](https://oj.shumeng.tech/p/CSP202506B)

当年这个道题我在考场上是使用的dfs，只拿到了80%的分，当时想用bfs的，实在是想不到怎么处理跳几次的问题，在考场上。后面使用gpt才知道，这个可以加一个**dist**数组来表示跳的距离，每跳一步，dist数组加1，这样方便更新

**dfs拿80分的代码如下：**

```
#include <bits/stdc++.h>

#define x first
#define y second

using namespace std;
typedef pair<int,int> PII;
const int N = 110;
int n,k;
bool st[N][N];
int cnt=0;

int dx[8]={-1,1,2,2,1,-1,-2,-2};
int dy[8]={2,2,1,-1,-2,-2,-1,1};

void dfs(int x,int y,int c){
	st[x][y]=true;
	for(int i=0;i<8;i++){
		if(x+dx[i] <= n && y+dy[i] <=n && c > 0 && x+dx[i] >= 1 && y+dy[i] >=1){
			st[x+dx[i]][y+dy[i]]=true;
			dfs(x+dx[i],y+dy[i],c-1);
		}
	}
}

int main()
{
	cin >> n >> k;
	PII p;
	cin >> p.x >> p.y;
	st[p.x][p.y]=true;
	dfs(p.x,p.y,k);
	
	int res=0;
	for(int i=1;i<=n;i++){
		for(int j=1;j<=n;j++){
			if(st[i][j]) res++;
		}
	}
	
	cout << res;
	return 0;
 } 
```

**bfs拿100分的代码如下：**

```c++
#include <bits/stdc++.h>

using namespace std;

typedef pair<int, int> PII;

const int N = 110;
int n, k;
int dist[N][N];
bool st[N][N];
int x, y;
queue<PII> q;

int dx[8] = {-1, 1, 2, 2, 1, -1, -2, -2};
int dy[8] = {2, 2, 1, -1, -2, -2, -1, 1};

int main(){
    cin >> n >> k;
    cin >> x >> y;

    q.push({x, y});

    memset(dist, -1, sizeof dist);
    memset(st, false, sizeof st);

    st[x][y] = true;
    dist[x][y] = 0;

    while(q.size()){
        auto t = q.front();
        q.pop();
        if(dist[t.first][t.second] > k) continue;

        for(int i = 0; i < 8; i ++ ){
            int a = t.first + dx[i];
            int b = t.second + dy[i];
            if(a >= 1 && a <= n && b >= 1 && b <= n && !st[a][b]){
                q.push({a, b});
                dist[a][b] = dist[t.first][t.second] + 1;
                st[a][b] = true;
            }
        }
    }

    int res = 0;
    for(int i = 1; i <= n; i ++ ){
        for(int j = 1; j <= n; j ++ ){
            if(dist[i][j] <= k && dist[i][j] >= 0){
                res ++;
            }
        }
    }
    
    cout << res;

    return 0;
}
```

##  [**CSP202503A**  数值积分](https://oj.shumeng.tech/p/CSP202503A)

一遍过，比较简单，写一个简单的f函数即可

```
#include <bits/stdc++.h>

using namespace std;

typedef long long LL;
int b, c, l, r;

LL f(int u){
    return u * u + b * u + c;
}

int main(){
    cin >> b >> c >> l >> r;

    int st;
    int ed = r;
    if(l % 2 != 0){
        st = l + 1;
    }
    else{
        st = l;
    }

    LL sum = 0;
    for(int i = st; i <= ed; i += 2){
        sum += f(i);
    }

    sum *= 2;

    cout << sum;

    return 0;
}
```

## [**CSP202503B**  机器人饲养指南](https://oj.shumeng.tech/p/CSP202503B)

完全背包问题，比较简单，但是完全背包完全忘了，我看这道题的通过率都快50%了，我没做出来，有点难受

```
#include <bits/stdc++.h>

using namespace std;
const int N = 10010;
int n, m;
int dp[N], a[N];

int main(){
    cin >> n >> m;

    for(int i = 1; i <= m; i ++ ) cin >> a[i];

    dp[0] = 0;

    for(int i = 1; i <= m; i ++ ){
        for(int j = 0; j <= n; j ++ ){
            if(j >= i){
                dp[j] = max(dp[j], dp[j - i] + a[i]);
            }
        }
    }
    cout << dp[n];

    return 0;
 }
```

## [**CSP202412A**  移动](https://oj.shumeng.tech/p/CSP202412A)

这道题代码比较简单，主要注意**边界条件**即可，注意什么时候是x➕1，什么时候是y➕1，什么时候是x-1，什么时候是y-1即可

```
#include <bits/stdc++.h>

using namespace std;
const int N = 110;
int n, k;


int main(){
    cin >> n >> k;

    for(int i = 0; i < k; i ++ ){
        int x, y;
        string s;
        cin >> x >> y >> s;

        for(int j = 0; j < s.size(); j ++ ){
            char c = s[j];

            if(c == 'r'){
                if(x < n){
                    x += 1;
                }
            }
            else if(c == 'b'){
                if(y > 1){
                    y -= 1;
                }
            }
            else if(c == 'f'){
                if(y < n){
                    y += 1;
                }
            }
            else if(c == 'l'){
                if(x > 1){
                    x -= 1;
                }
            }
        }
        cout << x << ' ' << y << endl;
    }
    return 0;
}
```

## [**CSP202412B**  梦境巡查](https://oj.shumeng.tech/p/CSP202412B)

这道题有点变态，我看通过率也不是很高463 / 2439  

这道题的主要用到了**前缀和后缀的思想**，什么是意思呢，你需要计算的是，去掉该点的能量后，你一开始需要携带多少能量才能走完全程。从第一个点，出发的路程会有损耗，到一个点了又会补充能量，一直走下去，走到最后一个点，a0起点需要携带多少能量。

**做法**：

1.计算need矩阵，`need[i]` 表示为了能够顺利走完第 `i` 段路，初始能量至少需要多少

need[i] = a[0] + a[1] + ... + a[i] - (b[1] + b[2] + ... + b[i])

2.引入了pre数组和sur数组，pre[i], 从开头到i，你需要的最大need[i]是多少，sur[i]:i～n最大的need[i]是多少， 为什么要引入这个两个数组？

当年去掉i点了之后，对于需求矩阵need[i]：不影响钱i-1个need数组元素的值，对于i～n，每一个need[i]都需要加上b[i]，所以你从起点走到n点，需求的能量发生了变化，是max(need[1], need[2], need[3], ..., need[i-1], need[i]+b[i],need[i+1]+b[i],...need[n]+b[i])

3.max(need[1], need[2], need[3], ..., need[i-1], need[i]+b[i],need[i+1]+b[i],...need[n]+b[i])，而pre[i]是前i个need中的最大值，sur[i]是i～n的最大值，因此最后的max(pre[i - 1], sur[i]+b[i])就是这么来的

4.pre[i]数组好理解是怎么构建的，sur数组的构建方式sur[i] = max(sur[i+1], need[i])

Sur[i]表示i~n的最大值，所以sur[i] = max(need[i], need[i+1], ...,need[n])，分两部分看，sur[i]=max(need[i], max(need[i+1], need[i+2], ...,need[n]))，后面一部分刚好是sur[i+1], 所以sur[i] = max(need[i], sur[i+1])。

```
#include <bits/stdc++.h>

using namespace std;
const int N = 100010;
int a[N], b[N];
int n;
int need[N];
int pre[N], sur[N];

int main(){
    cin >> n;

    for(int i = 0; i <= n; i ++ ){
        cin >> a[i];
    }

    for(int i = 1; i <= n; i ++ ){
        cin >> b[i];
    }

    int sumA = 0, sumB = 0;
    for(int i = 0; i < n + 1; i ++ ){
        sumA += a[i];
        if(i >= 1) sumB += b[i];

        need[i] = sumA - sumB;
    }

    pre[0] = need[0];
    for(int i = 1; i <= n; i ++ ){
        pre[i] = max(pre[i - 1], need[i]);
    }

    sur[n] = need[n];
    for(int i = n - 1; i >= 0; i  -- ){
        sur[i] = max(sur[i + 1], need[i]);
    }

    for(int i = 1; i <= n; i ++ ){
        int ans = max(pre[i - 1], sur[i] + b[i]);
        cout << ans << ' ';
    }

    return 0;
}
```

## [**CSP202409A**  密码](https://oj.shumeng.tech/p/CSP202409A)

代码还是比较简单的，只是一开始看错题意了，题目是只要出现了字母就行，**最后的判断在cout那部分需要好好注意一下**，其他的还是比较简单

```
#include <bits/stdc++.h>

using namespace std;

int main(){
    int n;
    cin >> n;

    while(n -- ){
        string s;
        cin >> s;
        int siz = s.size();

        bool letter = false;
        bool number = false;
        bool special = false;
        unordered_map<char, int> h;
        bool repeat = false;

        for(int i = 0; i < siz; i ++ ){
            if(isdigit(s[i])){
                number = true;
            }

            if((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= 'A' && s[i] <= 'Z')){
                letter = true;
            }

            if(s[i] == '#' || s[i] == '*'){
                special = true;
            }

            h[s[i]] ++;
            if(h[s[i]] > 2) repeat = true;
        }

        // if(number == true && letter == true && repeat == false && special == true){
        //     cout << 2 << endl;
        // }
        // else if(number == true && letter == true && repeat == true && special == true){
        //     cout << 1 << endl;
        // }
        // else if(number == false || letter == false || special == false){
        //     cout << 0 << endl;
        // }


        //下面这个判断写的更简洁一点
        if(number == true && letter == true  && special == true)
        {
            if(repeat == false) cout << 2 << endl;
            else cout << 1 << endl;
        }
        else{
            cout << 0 << endl;
        }

        
    }
    return 0;
}
```

## [**CSP202409B**  字符串变换](https://oj.shumeng.tech/p/CSP202409B)

第一版代码，思路比较简单，写了一个transform函数，暴力做法，但是超时了，本题尤其要注意输入输出的问题，**cin无法输入空格，需要getline，在cin >> n后，需要加一个getchar()吸收掉换行符，要不然会有错误**。处理f函数使用了**哈希表**。

```
#include <bits/stdc++.h>

using namespace std;
string s;
int n;
unordered_map<char, char> h;

void transform(string& s, int u){
    for(int i = 0; i < u; i ++ ){
        for(int j = 0; j < (int)s.size(); j ++ ){
            if(h.count(s[j])){
                s[j] = h[s[j]];
            }
        }
    }
}

int main(){
    getline(cin, s);
    cin >> n;
    getchar();

    while(n -- ){
        string str;
        getline(cin, str);
        h[str[1]] = str[2];
    }

    int k;
    cin >> k;

    for(int i = 0; i < k; i ++ ){
        int x;
        cin >> x;
        string ts = s;
        
        transform(ts, x);
        
        cout << ts << endl;
    }

    return 0;
}
```




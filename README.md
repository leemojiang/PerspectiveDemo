# 投影实验台

一个用原生 HTML、CSS、JavaScript 和 Canvas 实现的交互式投影演示。选择物体和投影方式后，可以拖动画布改变视向，或调节视场角、相机距离、斜投影角度等参数；立方体还可切换半透明线框和彩色面遮挡模式。页面同时显示投影公式，以及适用时的视图矩阵和投影矩阵。

项目集中在 **index.html**，无需安装依赖：直接用浏览器打开该文件即可。

## 投影方式一览

目前提供 19 种效果，分为四组：

| 类别 | 投影 |
| --- | --- |
| 中心投影 | 中心透视、反向透视、弱透视、Z 平行透视、XY 平行透视（伪两点） |
| 平行投影 | 正交、等轴测、斜投影、骑士投影、柜斜投影 |
| 曲线投影 | 等距鱼眼、立体鱼眼、心射、方位正射、兰伯特方位等积、等距柱面全景、墨卡托全景 |
| 非欧几何 | Poincaré 双曲球、Klein 双曲球 |

## 坐标与符号约定

物体顶点在模型坐标中写作

$$
\mathbf p=(x,y,z)^\mathsf T.
$$

原有模式以 **Y 轴为竖直方向、XZ 平面为地面**。**Z 平行透视**与 **XY 平行透视**以 **Z 轴为高度方向、XY 平面为地面方向**，其视向变换见下方专节；坐标轴标签始终表示模型坐标方向。

旋转后的视向坐标记作 $(x_c,y_c,z_c)^{\mathrm{rot}}$。除斜投影、两种轴向约束透视和仅旋转的双曲球模式外，相机视图矩阵为

$$
V=
\begin{bmatrix}
\cos\psi & 0 & -\sin\psi & 0\\
-\sin\eta\sin\psi & \cos\eta & -\sin\eta\cos\psi & 0\\
\cos\eta\sin\psi & \sin\eta & \cos\eta\cos\psi & -D\\
0&0&0&1
\end{bmatrix},
$$

其中 $\psi$ 是水平旋转角，$\eta$ 是俯仰角，$D$ 是相机距离。视图变换后的第三个分量为

$$
z_c=z_c^{\mathrm{rot}}-D,\qquad \delta=-z_c=D-z_c^{\mathrm{rot}}.
$$

因此 $z_c^{\mathrm{rot}}$ 越大，点越靠近观察者。画布宽、高分别为 $W,H$；屏幕坐标原点在左上角，向下为正。公式中的 $u,v$ 是屏幕位置，$s$ 是像素比例。

曲线与全景投影使用视线角度。令

$$
\rho=\sqrt{x_c^2+y_c^2},\qquad
\theta=\operatorname{atan2}(\rho,\delta).
$$

全景投影另外使用经度和纬度

$$
\lambda=\operatorname{atan2}(x_c,\delta),\qquad
\phi=\operatorname{atan2}\left(y_c,\sqrt{x_c^2+\delta^2}\right).
$$

$\theta,\lambda,\phi$ 均以弧度表示。方位角为零的视线落在圆形视场中心或全景画幅中央。

## 中心投影

### 中心透视

所有投影线汇聚到有限视点。透视除法让同样大小的物体随景深增加而变小：

$$
u=\frac W2+f\frac{x_c}{\delta},\qquad
v=\frac H2-f\frac{y_c}{\delta},\qquad
f=\frac{H}{2\tan(\theta_v/2)}.
$$

$\theta_v$ 是垂直视场角，$f$ 是焦距。页面的标准透视矩阵使用 $q=\cot(\theta_v/2)$ 和画幅比例 $a=W/H$：

$$
P_{\mathrm{persp}}=
\begin{bmatrix}
q/a&0&0&0\\
0&q&0&0\\
0&0&-(F+n)/(F-n)&-2Fn/(F-n)\\
0&0&-1&0
\end{bmatrix}.
$$

$n,F$ 是近、远裁剪距离；最后一行令齐次坐标 $w=-z_c=\delta$，除以 $w$ 后产生透视缩放。

### 反向透视

反向透视把齐次除数改成

$$
w=z_c+2D=D+z_c^{\mathrm{rot}},
\qquad
u=\frac W2+f\frac{x_c}{D+z_c^{\mathrm{rot}}},
\quad
v=\frac H2-f\frac{y_c}{D+z_c^{\mathrm{rot}}},
$$

其中 $z_c^{\mathrm{rot}}$ 是尚未减去相机距离的旋转后深度坐标。近处取正深度，远处取负深度。对称地取近、远深度 $+z,-z$，像的尺寸之比为

$$
\frac{m_{\mathrm{far}}}{m_{\mathrm{near}}}
=\frac{D+z}{D-z}>1 \qquad (0<z<D).
$$

因此近处较小、远处较大。反向透视只改变投影尺度规律，不翻转观察方向：中心透视方法之间切换时保留当前视角；从其他类别切入或重置时，使用相同的正向透视默认视角，便于比较。线框模式沿用正向透视的视点侧，实线较小、背侧虚线较大。开启彩色面模式时，仍由原视点侧的面作为前景并保持不透明；背侧彩色面以半透明方式先绘制，因此只会从较小前景面的轮廓外露出。拖动画布会同时改变两侧面的投影位置。奇异面为 $D+z_c^{\mathrm{rot}}=0$；演示场景保持在此面之前。

### 弱透视

当物体自身的景深变化相对于平均距离很小时，用统一平均深度 $D$ 近似每个顶点：

$$
u\approx\frac W2+\frac fD x_c,\qquad
v\approx\frac H2-\frac fD y_c.
$$

它保留整件物体随观察距离发生的缩放，但去掉了逐顶点的透视除法。

### Z 平行透视

在 **中心投影 → Z 平行透视** 中选择该模式。立方体、正方形、坐标轴和球体均可使用；地面网格平行于 XY 平面，正方形位于 XY 平面，Z 轴在画面中朝上。

- **水平角 ψ**：0°～360°，绕 Z 轴转动。
- **俯仰角 η**：−90°～90°，负值仰视，正值俯视。也可拖动画布改变这两个角度。
- **透视强度 k**：0～0.28，默认 0.22；越大，水平位置造成的近大远小越明显。
- **画面比例 s**：统一缩放画面，不改变灭点的有限性或竖边平行性质。
- **灭点与延长线 / 彩色面遮挡**：沿用立方体的两项开关。正常视角下显示 `Vz → ∞`，正俯视或正仰视时隐藏已退化的 Z 方向标记。

#### 投影公式

先按水平角计算横向坐标 $r$ 和水平深度 $d$：

$$
r=x\cos\psi-y\sin\psi,\qquad
d=x\sin\psi+y\cos\psi.
$$

令 $S=0.185\min(W,H)s$，则屏幕坐标为

$$
w=1-kd,\qquad
u=\frac W2+S\frac r w,\qquad
v=\frac H2-S\frac{z\cos\eta-d\sin\eta}{w}.
$$

透视分母 $w$ **不含世界坐标 $z$**。对固定的 $(x,y)$，高度变化 $\Delta z$ 产生

$$
\Delta u=0,\qquad \Delta v=-\frac{S\cos\eta}{1-kd}\Delta z.
$$

因此所有 Z 方向的直线都保持竖直、互相平行；不同水平位置仍有不同缩放，远处的等高竖边仍然更短。这是自定义的俯仰映射，空间直线仍投影成直线。

#### 齐次矩阵

页面显示的矩阵满足 $\mathrm{clip}=P V\,(x,y,z,1)^\mathsf T$：

$$
V=\begin{bmatrix}
\cos\psi&-\sin\psi&0&0\\
-\sin\eta\sin\psi&-\sin\eta\cos\psi&\cos\eta&0\\
\sin\psi&\cos\psi&0&0\\
0&0&0&1
\end{bmatrix},\qquad
P=\begin{bmatrix}
2S/W&0&0&0\\
0&2S/H&0&0\\
0&0&0&0\\
0&0&-k&1
\end{bmatrix}.
$$

这里的 $V$ 包含高度压缩，并非普通相机的刚体视图矩阵；第三分量只保存水平深度 $d$。$P$ 的第三行置零，用于 Canvas 二维显示，不提供 GPU 深度缓冲映射。彩色面的可见性根据该投影的等效视点计算。

#### 灭点与边界情况

当 $k>0$ 且 $\sin\psi\cos\psi\ne0$ 时，X、Y 两组边的灭点为

$$
V_x=\left(\frac W2-\frac{S\cos\psi}{k\sin\psi},\ \frac H2-\frac{S\sin\eta}{k}\right),\qquad
V_y=\left(\frac W2+\frac{S\sin\psi}{k\cos\psi},\ \frac H2-\frac{S\sin\eta}{k}\right).
$$

- **正对水平轴**：$\sin\psi=0$ 或 $\cos\psi=0$ 时，对应水平灭点也移到无穷远，退化为一点透视。
- **零透视强度**：$k=0$ 时，所有方向均为平行投影。
- **正俯视 / 正仰视**：$\eta=\pm90^\circ$ 时，$\cos\eta=0$，Z 边缩成点；页面显示退化提示。此实现没有人为保留高度，XY 平面仍按上述透视公式映射。
- **奇异平面**：必须保持 $w=1-kd>0$。新模式的地面网格范围为 $[-2,2]^2$；在支持的 $k\le0.28$ 下，全部演示物体和网格均位于奇异平面之前。

一般角度下 Z 方向不汇聚，与两点透视的 Z 方向约束一致。参考：[Rhino：Two-point perspective](https://docs.mcneel.com/rhino/9/help/en-us/properties/viewport.htm)。这里的可调俯仰公式与参数范围是本实验台的自定义设计。

### XY 平行透视（伪两点）

入口为 **中心投影 → XY 平行透视**。它与 Z 平行透视形成一组对照：

| 模式 | 透视分母 | X、Y 两组同向线 | Z 方向的线 |
| --- | --- | --- | --- |
| Z 平行透视 | $1-kd$ | 通常各自汇聚 | 保持平行 |
| XY 平行透视 | $1-kz$ | 各自保持平行 | 汇聚到一个灭点 |

“XY 各自平行”指所有 X 方向直线互相平行、所有 Y 方向直线互相平行；两组之间仍可有夹角。“伪两点”是这里对外观的称呼，其一般灭点结构为两个无穷远灭点和一个有限 Z 灭点。

#### 操作与公式

水平角、俯仰角、拖动旋转、画面比例以及立方体的灭点与遮挡开关均可使用。**Z 汇聚强度 k** 的范围为 0～0.28，默认 0.22，独立于 Z 平行透视的透视强度；两个模式之间切换会保留角度，便于比较。

仍令

$$
r=x\cos\psi-y\sin\psi,\qquad
d=x\sin\psi+y\cos\psi,\qquad
S=0.185\min(W,H)s.
$$

仅改变透视分母：

$$
\boxed{
w=1-kz,\qquad
u=\frac W2+S\frac r w,\qquad
v=\frac H2-S\frac{z\cos\eta-d\sin\eta}{w}
}
$$

同一高度的点共用同一缩放，改变 $x,y$ 不会引入透视缩放。两组水平线的屏幕方向分别正比于

$$
\mathbf e_X'=(\cos\psi,\ \sin\eta\sin\psi),\qquad
\mathbf e_Y'=(-\sin\psi,\ \sin\eta\cos\psi).
$$

即使水平位置或高度不同，同组直线的方向仍相同。固定 $x,y$、沿 Z 方向延长时，$k>0$ 对应的共同灭点为

$$
V_Z=\left(\frac W2,\ \frac H2+\frac{S\cos\eta}{k}\right).
$$

在这里的正 $k$ 约定下，高处的截面更大，竖边向负 Z 方向延长时趋向灭点。增大 $k$ 会使灭点更靠近画面中心，汇聚更明显。所有空间直线仍投影为直线。

#### 齐次矩阵与可见面

投影矩阵 $P$ 与上一个模式形式相同；视向变换 $V$ 的第三行改为直接输出世界高度 $z$：

$$
V=\begin{bmatrix}
\cos\psi&-\sin\psi&0&0\\
-\sin\eta\sin\psi&-\sin\eta\cos\psi&\cos\eta&0\\
0&0&1&0\\
0&0&0&1
\end{bmatrix},\qquad
P=\begin{bmatrix}
2S/W&0&0&0\\
0&2S/H&0&0\\
0&0&0&0\\
0&0&-k&1
\end{bmatrix}.
$$

这是一种自定义投影，角度控制画面形状，$V$ 并非普通相机的刚体变换。$P$ 的第三行用于二维显示，不提供 GPU 深度缓冲映射。彩色面的可见性沿用画面朝向：令 $\mathbf n=(\cos\eta\sin\psi,\cos\eta\cos\psi,\sin\eta)$，点 $\mathbf p$ 的有向视线为 $\mathbf n-k\sin\eta\,\mathbf p$；用它与面法线的点积判断正反面。球体轮廓也按同一投影计算。

#### 特殊角度与定义域

- **一般角度**：X、Y 两组边分别平行；只有 Z 有有限灭点。
- **严格平视 $\eta=0$**：XY 平面侧对画面，两组水平边投影到同一水平方向；若正对某个水平轴，该方向缩成点，页面隐藏它的无穷远标记。Z 方向仍有有限灭点。
- **正俯视 / 正仰视 $\eta=\pm90^\circ$**：Z 灭点位于画面中心；各处 Z 边指向中心。穿过原点的 Z 轴自身投影成一个点。
- **$k=0$**：三组同向线均保持平行；在特殊角度，沿视线的方向仍可缩成点。
- **定义域**：要求 $w=1-kz>0$。当 $k>0$ 时奇异平面为 $z=1/k$；当前所有物体与地面网格均在支持参数的安全范围内，不跨越该平面。

## 平行投影

### 正交投影

投影线相互平行，画面比例不依赖景深：

$$
u=\frac W2+s x_c,\qquad v=\frac H2-s y_c.
$$

对应的正交投影矩阵不包含透视除法：

$$
P_{\mathrm{ortho}}=
\begin{bmatrix}
2S/W&0&0&0\\
0&2S/H&0&0\\
0&0&-2/(F-n)&-(F+n)/(F-n)\\
0&0&0&1
\end{bmatrix},
$$

其中 $S$ 是投影比例，$n,F$ 是深度裁剪范围。

### 等轴测

等轴测是正交投影的一种标准视向：三个主轴在屏幕上的缩短比例相等。当前演示使用

$$
u=s\frac{x-z}{\sqrt2},\qquad
v=-s\frac{2y-x-z}{\sqrt6}.
$$

相机标准俯仰角为 $\arctan(1/\sqrt2)\approx35.264^\circ$，水平旋转角为 $45^\circ$。

### 斜投影、骑士投影与柜斜投影

正面与画面平行，因此正面尺寸不因深度变化；深度轴按角度 $\alpha$ 和缩短系数 $k$ 斜向画出：

$$
u=\frac W2+s(x+kz_c^{\mathrm{rot}}\cos\alpha),\qquad
v=\frac H2-s(y+kz_c^{\mathrm{rot}}\sin\alpha).
$$

- **斜投影**：$\alpha$、$k$ 均可调。
- **骑士投影（Cavalier）**：标准值 $\alpha=45^\circ,\ k=1$，深度不缩短。
- **柜斜投影（Cabinet）**：标准值 $\alpha=45^\circ,\ k=0.5$，深度缩短一半。

骑士和柜斜预设也保留滑块，因此可以从标准构型继续探索其他斜投影比例。

## 曲线与球面方向投影

这组方法先把三维点转换成视线方向，再把角度映射到平面。对圆形方位投影，除中心点外，屏幕坐标通式为

$$
u=\frac W2+\frac r\rho x_c,\qquad
v=\frac H2-\frac r\rho y_c.
$$

以方位角确定圆盘上的方向，以径向函数 $r(\theta)$ 决定离圆心的距离。$f$ 和 $R$ 是投影尺度（像素），演示会根据视场角把圆形边缘缩放到视口内。

| 投影 | 径向映射 | 主要性质 |
| --- | --- | --- |
| 等距鱼眼 | $r=f\theta$ | 半径与视线夹角成正比。 |
| 立体鱼眼 | $r=2f\tan(\theta/2)$ | 保持局部角度；越靠近边缘，拉伸越明显。[PROJ：立体投影](https://proj.org/en/stable/operations/projections/stere.html) |
| 兰伯特方位等积 | $r=2R\sin(\theta/2)$ | 保持球面面积比例。 |
| 心射投影 | $r=f\tan\theta$ | 球面大圆映成直线；定义域限于 $\theta<90^\circ$，接近地平线时趋于无穷。 |
| 方位正射投影 | $r=R\sin\theta$ | 只显示中心半球，地平线映到有限圆周。 |

兰伯特方位等积和心射投影是常见的方位投影；方位正射投影一次显示一个半球。[PROJ：兰伯特方位等积](https://proj.org/en/stable/operations/projections/laea.html) · [PROJ：心射投影](https://proj.org/en/stable/operations/projections/gnom.html) · [PROJ：正射投影](https://proj.org/en/stable/operations/projections/ortho.html)

### 等距柱面全景

将经纬角分别线性映到水平与垂直坐标：

$$
u=W\left(\frac12+\frac{\lambda}{2\pi}\right),\qquad
v=H\left(\frac12-\frac{\phi}{\pi}\right).
$$

水平覆盖 $360^\circ$，垂直覆盖 $180^\circ$；左右边缘是相邻的同一条经线，因此越过接缝的线段会绕回另一侧。它使用的经纬坐标形式也称等距柱面或 Plate Carrée。[PROJ：等距柱面投影](https://proj.org/en/stable/operations/projections/eqc.html)

### 墨卡托全景

经度仍按等距柱面方式展开，纬度先经过等角的墨卡托变换：

$$
M(\phi)=\ln\tan\left(\frac\pi4+\frac\phi2\right),\qquad
u=W\left(\frac12+\frac{\lambda}{2\pi}\right),\qquad
v=H\left(\frac12-\frac{M(\phi)}{2\pi}\right).
$$

$M(\phi)$ 在极点处发散，所以实现把纬度截断到 $\pm85.05112878^\circ$，使 $M$ 的范围接近 $\pm\pi$，得到有限画幅。高纬区域因而被显著拉伸。该纬度截断与屏幕归一化是本演示的选择；标准球面墨卡托的基本纬度函数见 [PROJ：墨卡托投影](https://proj.org/en/stable/operations/projections/merc.html)。

## 非欧几何：双曲球模型

这里的输入向量 $\mathbf x=(x,y,z)$ 是双曲空间中以观察中心为原点的指数坐标；$r=\|\mathbf x\|$ 表示双曲距离（曲率归一化为 $K=-1$）。沿径向把它映到单位球内。令 $\mathbf p$ 是球模型坐标：

$$
\mathbf p_{\mathrm{P}}=
\frac{\tanh(r/2)}r\,\mathbf x
\qquad\text{（Poincaré 球）},
$$

$$
\mathbf p_{\mathrm{K}}=
\frac{\tanh r}r\,\mathbf x
\qquad\text{（Klein 球）}.
$$

当 $r=0$ 时使用连续极限 $\mathbf p=\mathbf0$。当 $r\to\infty$ 时，两种模型都趋近单位球边界，表示无限远处。它们不是普通的相机透视矩阵：先做非线性球映射，再用正交方式把模型显示在画布上。

两者区别体现在双曲度量和测地线上：

$$
ds_{\mathrm{P}}^2=
\frac{4\,|d\mathbf p|^2}{(1-|\mathbf p|^2)^2}
\qquad\text{（Poincaré）},
$$

$$
ds_{\mathrm{K}}^2=
\frac{|d\mathbf p|^2}{1-|\mathbf p|^2}
+\frac{(\mathbf p\cdot d\mathbf p)^2}{(1-|\mathbf p|^2)^2}
\qquad\text{（Klein）}.
$$

- **Poincaré 球**保持角度；测地线是直径或与单位球边界正交的圆弧。
- **Klein 球**不保持角度，但测地线是球内直弦。

这两个模型都描述负曲率双曲空间，只是坐标表示不同。参考：[Ohio State 双曲几何讲义](https://math.osu.edu/sites/math.osu.edu/files/hyperbolicGeometry.pdf) · [University of Kentucky：Beltrami–Klein 模型](https://www.ms.uky.edu/~droyster/courses/fall96/math3181/notes/hyprgeom/node57.html)

## 如何读页面中的矩阵

- **P** 是投影变换。中心透视、弱透视、反向透视、Z 平行透视、XY 平行透视、正交和斜投影可用 $4\times4$ 齐次矩阵表达；等轴测由标准视向矩阵与正交投影组合得到。
- **V** 通常是观察视向与相机距离。转动画布会改变视角部分；斜投影保持 $V=I$，Z 平行透视与 XY 平行透视使用上文的专用 $V$。
- 斜投影把深度分量按 $k\cos\alpha$、$k\sin\alpha$ 加入横、纵坐标；对应矩阵的第三列记录这两个系数。
- 鱼眼、方位投影、柱面全景和双曲球使用非线性映射，不存在能单独表达完整映射的普通 $4\times4$ 投影矩阵；页面会显示对应的函数和参数。

本项目是用于比较视觉行为的理想化演示：球面投影以球面方向为输入，未实现椭球大地测量、地图基准转换或 GIS 的完整裁切体系。

## 验证

安装 Node.js 后运行 `node tests/projection.test.cjs`。测试直接读取页面中的投影实现，检查两种轴向约束模式的平行性与汇聚、矩阵和绘图的一致性、特殊角度、可见面与所有模式的基本绘制。

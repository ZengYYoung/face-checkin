# 人脸签到系统 REST API

第一周接口设计 v1 · 曾杨洋（241250081，前端） · 张靖宇（241250073，后端）

手机浏览器与 Spring Boot 使用同一站点，公共路径为 `/api/v1`。下表和各节中的路径均相对此前缀。示例中的人员、编号和时间均为测试数据。

## 1. 接口总览

| 方法与路径 | 用途 | 权限 | 成功响应 |
| --- | --- | --- | --- |
| `POST /users` | 注册并录入标准照 | 公开 | 201 用户 |
| `POST /sessions` | 学号密码登录 | 公开 | 201 会话 |
| `GET /sessions/current` | 刷新页面后恢复登录状态 | 已登录 | 200 会话 |
| `DELETE /sessions/current` | 退出登录 | 当前会话 | 204 |
| `GET /users` | 浏览人员及标准照录入状态 | 管理员 | 200 分页用户列表 |
| `GET /users/{userId}/face-photo` | 读取当前标准照 | 本人或管理员 | 200 图片 |
| `PUT /users/{userId}/face-photo` | 补录或替换标准照 | 本人或管理员 | 首次 201，替换 204 |
| `DELETE /users/{userId}/face-photo` | 移除标准照 | 本人或管理员 | 204 |
| `POST /check-ins` | 现场拍照、识别并打卡 | 公开 | 首次写入 201，成功重放 200 |
| `GET /attendance-days` | 查看按人、按日汇总的考勤 | 已登录 | 200 分页考勤列表 |

**传输与类型。** 使用 HTTPS。普通请求和响应均为 JSON，上传使用 `multipart/form-data`，读取照片直接返回图片，204 响应体为空。字段采用 camelCase；ID 和学号均为字符串。日期按北京时间（`Asia/Shanghai`）计算，时间戳携带偏移，例如 `2026-11-24T08:30:00+08:00`。

**身份与数据范围。** 服务端用会话 Cookie 识别登录者，设置 `HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`。Vue 同源请求随浏览器发送 Cookie，服务端对浏览器发起的写请求校验同源。角色取 `STUDENT` 或 `ADMIN`，由服务端分配。打卡始终以本次照片确定身份，包括手机已登录其他账号的情形。个人信息、认证响应、考勤结果和照片均使用 `Cache-Control: no-store`。

**照片。** 字段名统一为 `photo`，每次一张 JPEG 或 PNG，应用侧限 5 MiB（5,242,880 字节）。手机可将其他格式转换后再上传，服务端按实际内容验证并解码，规格适配后送入 FRS。注册和换照允许拍照或从相册选择；打卡页提供现场拍照入口。上传时由浏览器生成带 boundary 的 Content-Type。

## 2. 账号与会话

**注册**　`POST /users` 接受四个必填表单字段。

| 字段 | 规则 |
| --- | --- |
| `studentNo` | 学号，1～32 位数字字符串，保留前导零，全系统唯一 |
| `name` | 姓名，去除首尾空白后 1～64 个字符 |
| `password` | 密码，8～64 个字符，保留原始输入，后端保存密码哈希 |
| `photo` | 本人标准照，必须恰好检测到一张人脸 |

账号和有效照片映射均建立后返回 201 和以下用户对象。注册完成后前端进入登录页。学号重复返回 409；云端录入失败时允许用户重试。即使两名学生长相相似，也允许分别录入；打卡时按第 4 节处理歧义。

```json
{"id":"u_101","studentNo":"000000001","name":"陈小禾","role":"STUDENT","hasFacePhoto":true}
```

**登录**　`POST /sessions` 接受 JSON，例如 `{"studentNo":"000000001","password":"example-password"}`。成功后创建会话，响应含 `Set-Cookie` 和 `Location: /api/v1/sessions/current`。会话响应如下。密码错误与学号不存在均返回 401 `INVALID_CREDENTIALS`。

```json
{"user":{"id":"u_101","studentNo":"000000001","name":"陈小禾","role":"STUDENT","hasFacePhoto":true}}
```

**恢复与退出**　`GET /sessions/current` 返回相同结构，未登录或会话过期返回 401 `UNAUTHENTICATED`。`DELETE /sessions/current` 令会话失效并清除 Cookie；重复退出也返回 204。

## 3. 照片库

管理员用 `GET /users?studentNo=000000001&page=1&size=20` 按学号精确查找；省略学号则按学号升序浏览所有学生，包括尚无有效标准照的学生。返回第 5 节的分页结构，`items` 的每一项是第 2 节的用户对象。学生从当前会话取得本人的 `user.id`，可直接构造照片地址。

| 对 `/users/{userId}/face-photo` 的操作 | 请求与效果 |
| --- | --- |
| GET | 成功时返回 `image/jpeg` 或 `image/png` 字节，可直接绑定到同源 `<img>`。尚无标准照时返回 404 `PHOTO_NOT_FOUND`。 |
| PUT | 表单仅含 `photo`。更新成功即生效；此前无照片时返回 201 和指向本照片的 Location，已有照片时返回 204，二者响应体均为空。上传或识别失败时旧照继续有效。 |
| DELETE | 移除有效映射后返回 204，已无照片时也返回 204。其后该用户不能凭已删除的映射打卡，历史考勤仍可查。 |

三种操作均先校验登录状态和数据权限。学生访问其他人的照片返回 403；管理员操作不存在的用户返回 404 `USER_NOT_FOUND`。

## 4. 匿名打卡

`POST /check-ins` 接受 `multipart/form-data`。两个必填字段为 `photo` 和 `requestId`（前端为每次新拍摄生成的随机 UUID）。完成一次成功写入返回 201。下面是 Vue 页面可以直接使用的请求示例，`file` 来自相机输入框。

```javascript
const body = new FormData()
body.append('requestId', crypto.randomUUID())
body.append('photo', file)
// 若请求超时，重试时复用这个 body。用户重新拍摄时再建一个。
const response = await fetch('/api/v1/check-ins', { method: 'POST', body })
const result = await response.json()
```

首次成功的响应示例：

```json
{
  "checkInId": "c_901",
  "maskedName": "陈*禾",
  "receivedAt": "2026-11-24T08:30:00+08:00",
  "day": {
    "date": "2026-11-24",
    "firstCheckInAt": "2026-11-24T08:30:00+08:00",
    "lastCheckOutAt": null,
    "status": "PENDING_CHECKOUT"
  }
}
```

- **身份反馈**。匿名响应只展示脱敏姓名供现场核对。单字姓名显示 `*`，双字保留首字加 `*`，三字及以上保留首尾并在中间显示一个 `*`。公开响应省略学号、完整姓名、用户 ID、候选人及分数。
- **一天多次**。`receivedAt` 取成功写入所对应请求的服务器接收时间。当日一条为 `PENDING_CHECKOUT`（待签退），两条起为 `COMPLETE`（已有签到和签退）。`firstCheckInAt` 和 `lastCheckOutAt` 分别取最早和最晚接收时间。中午后仍可打卡；跨午夜按北京时间分属两日。
- **识别歧义**。检索时比较不同用户的有效候选人。无人达到识别阈值，返回 422 `FACE_NOT_RECOGNIZED`。前两名均达到阈值、且分差小于区分阈值时，返回 422 `FACE_AMBIGUOUS` 并提示重拍。其余情况下取达标的最高分候选人。两个阈值由后端通过联调样本校准。拒识、限流、云服务失败均不写入有效打卡。
- **重试**。同一编号与相同照片只产生一条明细；成功重试返回 200 和首次提交成功时的结果快照。同编号用于另一张照片时返回 409 `REQUEST_ID_CONFLICT`。若原请求仍在处理，返回 409 `CHECK_IN_PROCESSING` 并附 `Retry-After`。服务端应将编号与图片内容摘要绑定，在并发写入时执行唯一约束。客户端超时、遇到 429 或 503 时，可复用原照片与编号重试。

## 5. 每日考勤

`GET /attendance-days` 每行代表一个学生一天的有效考勤。学生只查询本人；管理员默认查询所有学生，也可以按学号筛选。

| 查询参数 | 规则 |
| --- | --- |
| `from`、`to` | 可选，格式 `YYYY-MM-DD`，两端均含。都省略时取今天，只提供一端时取该单日；起日大于止日返回 400。 |
| `studentNo` | 可选，仅管理员使用，学号精确匹配。学生传入该筛选条件返回 403。 |
| `page`、`size` | 两个列表接口共用。页码从 1 起，默认 1；每页默认 20，取值 1～100。非法值返回 400。 |

示例请求为 `GET /api/v1/attendance-days?from=2026-11-24&to=2026-11-24`。响应按日期降序、学号升序排列。`total` 是筛选后的考勤汇总行数；没有打卡的日期没有对应行。查询无结果或页码超过末页均返回 200 和空 `items`。

```json
{
  "items": [
    {
      "userId": "u_101",
      "studentNo": "000000001",
      "name": "陈小禾",
      "date": "2026-11-24",
      "firstCheckInAt": "2026-11-24T08:30:00+08:00",
      "lastCheckOutAt": "2026-11-24T18:05:00+08:00",
      "status": "COMPLETE"
    }
  ],
  "page": 1,
  "size": 20,
  "total": 1
}
```

## 6. 错误与页面反馈

错误统一返回 JSON，图片读取失败也遵循此约定。页面按稳定的 `code` 分支，`message` 可直接展示。`field` 仅在能定位单个输入项时返回。

```json
{"code":"FACE_AMBIGUOUS","message":"无法区分相似人员，请在光线充足处正对镜头重拍。","field":"photo"}
```

| HTTP | code | 页面处理 |
| --- | --- | --- |
| 400 | `INVALID_ARGUMENT` | 按字段提示补齐或修改输入；含无效 UUID、分页或日期。 |
| 401 | `INVALID_CREDENTIALS`、`UNAUTHENTICATED` | 前者提示核对学号密码；后者引导登录。 |
| 403 | `FORBIDDEN` | 提示无权限。 |
| 404 | `USER_NOT_FOUND`、`PHOTO_NOT_FOUND` | 前者提示无此用户；后者显示待录入状态。 |
| 409 | `STUDENT_NO_TAKEN`、`REQUEST_ID_CONFLICT`、`CHECK_IN_PROCESSING` | 分别提示学号已注册、为新照片生成新编号、按响应头等待后重发原请求。 |
| 413 / 415 | `PHOTO_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` | 压缩图片或改用支持的格式。 |
| 422 | `INVALID_IMAGE`、`NO_FACE`、`MULTIPLE_FACES` | 提示重新选择清晰、单人的照片。 |
| 422 | `FACE_NOT_RECOGNIZED`、`FACE_AMBIGUOUS` | 分别显示「未识别到已录入人员」「无法区分相似人员，请重拍」。 |
| 429 | `RATE_LIMITED` | 读取 `Retry-After`（秒），等待后重试。 |
| 503 | `FACE_SERVICE_UNAVAILABLE` | 提示云识别暂不可用；稍后重试。 |
| 500 | `INTERNAL_ERROR` | 提示系统异常；打卡结果未知时保留原请求编号。 |

## 7. 联调验收

1. **账号与权限**。注册后登录，刷新页面应能恢复会话。退出后，照片和记录接口均返回 401。学生 A 访问学生 B 的照片返回 403，管理员可按 B 的学号找到该学生。
2. **照片管理**。上传、替换、删除、再补录各一次。删除后读取照片返回 404，已有考勤仍能查看。尝试用多人合照换照，验证 422 且旧照可读。
3. **打卡与签退**。同一部手机依次为不同学生打卡。验证公开响应的脱敏姓名、一次待签退、三次取最早与最晚，以及未录入者打卡后数据库有效记录数不变。
4. **歧义与并发**。准备两个分数接近的有效候选响应，验证返回 `FACE_AMBIGUOUS` 且零写入。并发重发同一请求编号及照片，验证仅产生一条明细。模拟队列满时检查 429 及 `Retry-After`。

# USER_MODEL_OVERRIDE｜一句话切模型

| 角色 | 模型（精确ID，照抄执行） | 执行通道 | 调用方式 |
|---|---|---|---|
| task-manager | 开窗口时定 | 本窗口 | 本窗口subagent直派，按开窗口时模型执行 |
| supervisor | opencode-go/muse-spark-1.3-contributor | opencode | 派工基础设施走opencode直调：`opencode run -m opencode-go/muse-spark-1.3-contributor "任务"`；表内记全ID，禁本窗口代做 |
| builder | codebuddy/deepseek-v4.1-flash | codebuddy | `codebuddy --model deepseek-v4.1-flash --effort high -y -p "任务"`（非交互必带`-y`，验成功只看正文）；表内记全ID，禁本窗口代做。限额停工→切 codebuddy/glm-5.3-flash（同形，2026-09-16 已验 pong）；再限额→停派喊人。 |
| planner | codex/gpt-5.6-sol | codex | 派工基础设施走codex直调；CLI用短名`gpt-5.6-sol`：`codex exec -m "gpt-5.6-sol" --skip-git-repo-check "任务" </dev/null`；表内记全ID，禁本窗口代做 |
| code-reviewer | opencode/muse-spark-1.3-contributor-free | 本窗口 | 本窗口subagent直派 |
| qa | codex/gpt-5.6-luna | 本窗口 | 本窗口直派；真机QA（adb/Expo）走本窗口 bash 直驱，note 记原因，supervisor 不记偏离。表内记全ID。 |
| product-reviewer | codex/gpt-5.6-terra | codex | 派工基础设施走codex直调；CLI用短名`gpt-5.6-terra`：`codex exec -m "gpt-5.6-terra" --skip-git-repo-check "任务" </dev/null`；表内记全ID，禁本窗口代做 |
| experience-recorder | opencode/muse-spark-1.3-contributor-free | 本窗口 | 本窗口subagent直派 |
| neat-freak | opencode/muse-spark-1.3-contributor-free | 本窗口 | 本窗口subagent直派 |
| senior-expert | codex/gpt-5.6-sol | codex | 派工基础设施走codex直调；CLI用短名`gpt-5.6-sol`：`codex exec -m "gpt-5.6-sol" --skip-git-repo-check "任务" </dev/null`；表内记全ID，只接升级任务，禁本窗口代做 |

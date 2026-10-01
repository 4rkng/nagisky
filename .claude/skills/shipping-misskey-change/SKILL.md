---
name: shipping-misskey-change
<<<<<<< HEAD
description: Use at every "finish" moment of a Misskey change — immediately before committing, opening a PR, merging, or handing the work back to the user even without a commit. Runs the final pre-ship checklist — `pnpm lint`, misskey-js regeneration (`pnpm build-misskey-js-with-types`) when backend API changed, `pnpm --filter backend check-migrations` when entities or migrations changed, SPDX header verification on new files, locale safety check (no edits to non-`ja-JP` locale yml files), and `CHANGELOG.md` Unreleased entry for user-visible changes. Must be consulted as the last step of every change — including uncommitted handoffs — to avoid CI failures and lost translations. This is NOT waived by having already invoked brainstorming, writing-plans, or any other upstream skill — invoke this regardless of what preceded it.
=======
description: Use at every finish moment of a Misskey change, before committing, opening a PR, merging, or handing work back. Selects proportional validation, runs changed-file lint and repository safety checks, and records PASS/FAIL/BASELINE/SKIPPED without chasing unrelated failures.
>>>>>>> 8f438a8a00ba7f08dfe5fe8db3394c86d82572f3
---

# shipping-misskey-change

<<<<<<< HEAD
Misskey の変更の **finish 局面** (commit / PR / merge する直前、またはコミットせずユーザーに作業を返す直前) に必ず走らせる最終チェックリスト。

CI で落ちやすい / レビュアーから指摘されやすいポイントを 1 箇所に集めている。後で references を辿る余裕を作らないため、チェックリストは SKILL.md 本体に直書きする。

**他スキル実行後も免除されない。** `brainstorming` / `writing-plans` / その他アップストリームスキルを先に呼んでいても、作業を返す直前・commit 直前のタイミングでこのスキルを呼ぶこと。

## 最終チェックリスト

このリストを TodoWrite に展開して 1 項目ずつ確認すること。**該当しない項目は飛ばして良いが、判断は明示する**。

- [ ] lint が通る — ECC 由来の [/quality-gate](../../commands/quality-gate.md) コマンドで lint (typecheck + eslint) + 高速テストをまとめて回すのが基本。lint だけ単発で確認したいなら `pnpm lint` 直接でもよい
- [ ] backend で `meta` / `paramDef` / `res` を変更した → `pnpm build-misskey-js-with-types` を実行して `packages/misskey-js/src/autogen/` の差分も commit に含めた → 詳細手順は [references/tasks/regenerate-misskey-js.md](references/tasks/regenerate-misskey-js.md)
- [ ] エンティティ (`packages/backend/src/models/*.ts` の `@Column` / `@Entity` / `@Index`) を変更した → `pnpm --filter backend check-migrations` が pending DDL 0 件で通る
- [ ] migration ファイルを追加した → `up()` と `down()` の両方を実装した / 既存のマージ済 migration は一切触っていない
- [ ] 新規 `.ts` / `.js` / `.cjs` / `.mjs` / `.vue` / `.scss` / `.html` ファイルを追加した → SPDX ヘッダーを付けた (`.vue` / `.html` は HTML コメント形式、その他は TS コメント形式)
- [ ] `locales/` を編集した → **`ja-JP.yml` だけ** を変更しており、他言語 yml の diff は出ていない (`git diff --name-only develop -- 'locales/*.yml' | grep -v '^locales/ja-JP\.yml$'` が空)
- [ ] ユーザーから見える変更 (機能追加 / 既存挙動変更) → `CHANGELOG.md` の `## Unreleased` 直下の該当サブセクション (General / Client / Server) に 1 行追記した → 詳細書式は [references/tasks/changelog-update.md](references/tasks/changelog-update.md)
- [ ] backend API endpoint を追加・変更した → [misskey-api-reviewer](../../agents/misskey-api-reviewer.md) agent を Task で起動して機械レビューする (endpoint-list 登録漏れ / misskey-js 再生成漏れ / meta・UUID / SPDX。lint や CI では拾いにくい 404・登録漏れの最終関門なので、該当する変更があれば飛ばさない)
- [ ] frontend の `.vue` を追加・変更した → [vue-component-reviewer](../../agents/vue-component-reviewer.md) agent を Task で起動して機械レビューする (SPDX 形式 / 命名 / i18n / SCSS 変数 / os.* / a11y / Storybook 併設)
- [ ] (任意) `.claude/` ハーネス自体の健全性を確認したい → ECC 由来の [/harness-audit](../../commands/harness-audit.md) コマンドを実行

## 何のためのスキルか

これは「**作業中に何を作るか**」を決めるスキルではなく、「**作り終わった後に CI を通す**」スキル。`working-on-backend` / `working-on-frontend` から始まった作業の **出口** として機能する。

該当する変更がある場合は各 references/tasks/ を Read して詳細手順を踏むこと。`pnpm lint` だけは references を読まずに直接走らせて良い (`/quality-gate` でまとめて回せる)。
=======
Misskey の変更を commit / PR / merge する直前、または未commitでユーザーへ返す直前の出口。
規範は [AGENTS.md](../../../AGENTS.md)、ここでは実行方法だけを定める。

## 1. 検証レベル

| 段 | 条件 | 実行 |
| --- | --- | --- |
| 1 (必須) | package の ESLint 対象ファイルを変更 | 存在する変更ファイルへ `eslint --quiet` を最後に 1 回 |
| 2 | 実装・挙動を変更 | 最も近い unit test を実行。型・生成物・DB に関係するときは対応する専用検証も実行 |
| 3 (任意) | 明示依頼、広域変更、切り分けに必要 | package / repo 全体の lint、build、広域 test |

段 1 は docs-only など対象が空なら `SKIPPED`。
段 3 の既存失敗は成功扱いせず `BASELINE` として、今回の変更との関係だけを報告する。

### 自動検査

repo root で次を 1 回実行する。

```bash
node scripts/check-shipping.mjs
```

統合先を明示する場合は `--base <ref>`、または `MISSKEY_BASE_REF` を使う。
script は次を行い、独立した検査を最後まで続けて exit 0 (合格) / 1 (違反) / 2 (検査不能) に集約する。

- commit 済み・未commit・untracked の変更集合を NUL-safe に列挙し、変更ファイルだけへ package root から `eslint --quiet` を実行
- SPDX 違反時はローカル変更の欠落だけ `check-spdx.mjs --fix` で補い、通常検査を再実行
- SPDX の結果にかかわらず、`locales/ja-JP.yml` 以外の locale YAML 変更を検査

`SPDX: OK` 後は追加確認しない。
その他の常設方針は AGENTS.md に従う。

## 2. 変更別チェック

- backend API の `meta` / `paramDef` / `res`: `pnpm build-misskey-js-with-types`。
  手順は [regenerate-misskey-js.md](references/tasks/regenerate-misskey-js.md)
- entity / migration: `pnpm --filter backend check-migrations`。
  新規 migration は `up()` / `down()`、既存のマージ済 migration は差分なし
- backend API endpoint: [misskey-api-reviewer](../../agents/misskey-api-reviewer.md) を実行
- frontend `.vue`: [vue-component-reviewer](../../agents/vue-component-reviewer.md) を実行

## 3. 引き継ぎ

実行項目を `PASS / FAIL / BASELINE / SKIPPED` で短く列挙する。
失敗時は今回の変更との関係、未実行時は理由を書く。
ユーザーが依頼していない commit / PR / 外部送信は行わない。
>>>>>>> 8f438a8a00ba7f08dfe5fe8db3394c86d82572f3

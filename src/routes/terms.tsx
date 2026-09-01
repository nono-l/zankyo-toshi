/*
  配信規約（ビデオポリシー）。条件は ID 連携のみ。ゲームループは持たない。
*/
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <main className="min-h-dvh bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <article className="panel mx-auto w-full max-w-lg p-6 sm:p-8">
        <p className="text-muted mb-2 text-xs tracking-[0.28em]">ECHOES OF COLLAPSE</p>
        <h1 className="font-display text-3xl leading-tight">配信規約</h1>
        <p className="text-subtle mt-1 text-xs tracking-wider">ビデオポリシー</p>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          この廃墟の光景を、外へ運ぶことについての契約である。許諾は短い。条件はひとつである。
        </p>

        <section className="border-line mt-6 border-t pt-5">
          <h2 className="font-display text-lg">条件</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            ID連携をすること。名を残した探索だけが、外へ持ち出してよい。連携なき配信は、規格の外であり、許可しない。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">許可</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            連携した名があるなら、いくらでも許可する。実況、録画、切り抜き、再編集、転載、公開を含む。回数を問わない。長さを問わない。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">問わないもの</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            プラットフォームを問わない。個人を問わない。企業を問わない。収益の有無を問わない。有料か無料かを問わない。視聴者の多寡を問わない。事前の届け出は要らない。収益の分配も要らない。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">残してよいもの</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            シードの名、文明の名、核の名、断片の文、測量の閃光、緊急脱出の記録。滅び方は隠さなくてよい。この契約の文を画面に出す必要もない。出してもよい。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">残す必要のないもの</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            許可を請う手紙は要らない。ロゴの掲出も要らない。ただし、この廃墟を、連携していない複製として配ってはならない。光景は運んでよい。入口そのものを、名なしに複製してはならない。
          </p>
        </section>

        <p className="text-subtle mt-6 text-xs leading-relaxed">
          光は税であった。名は戸籍である。名のある探索は、外の夜へ出てよい。
        </p>

        <Link to="/" className="btn-primary mt-8 flex w-full items-center justify-center">
          入口に戻る
        </Link>
      </article>
    </main>
  );
}

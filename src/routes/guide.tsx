/*
  滅び方の読み方。操作マニュアル英語にはしない。ゲームループは持たない。
*/
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/guide")({ component: Guide });

function Guide() {
  return (
    <main className="min-h-dvh bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <article className="panel mx-auto w-full max-w-lg p-6 sm:p-8">
        <p className="text-muted mb-2 text-xs tracking-[0.28em]">ECHOES OF COLLAPSE</p>
        <h1 className="font-display text-3xl leading-tight">遊び方</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          文明の文法が先にあり、廃墟はその劣化結果である。ここにあるのは操作の手順ではない。滅び方の読み方である。
        </p>

        <section className="border-line mt-6 border-t pt-5">
          <h2 className="font-display text-lg">踏入</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            シードは、どの滅びを踏むかの名である。同じ名は同じ死に方を返す。出口に戻るたび、入口の名は別の滅びへ引き直される。気に入った滅びは、名を書き残して再び踏め。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">歩幅と視線</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            左の円は歩幅である。指を置けば、その向きへ進む。画面の空いたところを滑らせれば、視線が動く。柱は実体であり、坂も実体である。通り抜けようとしてはいけない。傾いた橋は、低い側からのみ登れる。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">灯火</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            光は税であった。いま残る灯は短い。消せば、およそ六メートル先までしか輪郭はない。灯せば、およそ二十メートルまで戻る。闇は演出ではなく、規格の残りである。炎の印を押せ。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">測量の閃光</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            この文明は影の長さで時刻を決めた。六十秒がひと拍。その拍ごとに、距離を測る基準閃光を撃つ規格があった。灯火では届かない遠方が、一秒だけ輪郭を返す。冷却のあいだ、印は秒を数える。規格は待たせる。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">断片</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            床に浮かぶ白いものは、記録の残りである。触れれば読める。核と呼ばれる場所へ近い断片ほど、その滅びの本文に近い。拾ったものは、出口まであなたの手の中にある。まだ戸籍ではない。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">入口の光</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            踏入した場所に、輪の光がある。それに触れる半径からのみ、通常に出られる。出れば、拾った断片は日付と場所とともに残る。触れずに出ることは緊急脱出である。その廃墟で拾った断片は没収され、記録に残るのは脱出したという事実だけである。光は出口であり、出口は契約である。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">傘おばけ</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            廊を滑るものは、人ではない。レールの上だけを、あなたよりわずかに速く往く。カケラを取るたび五体増える。灯を消せば、経路が蒼く浮かぶ。触れれば、器は傘と仲良しになる。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">ミミックさん</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            壁際に三十。十メートルだけ同じ速さで寄ってくる。触れればハッピーエンド。記録には、ミミックさんに捕まった、と残る。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">アカミソ</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            柱の側に八割。消灯のときだけ光る。灯の下ではほとんど透ける。一秒以上触れると強制脱出である。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">鉄パイプの妖精さん</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            水の側に、鉢の黒髪で立つ。継手のついた管を横に構える。暇ならラジオ体操。罰は、まだない。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">ゆきおんな</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            屋根のない空の下に立つ。白髪と淡い着物。顔はイラスト。暇ならラジオ体操。罰は、まだない。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">めりさん</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            祠の側に立つ。紫のヴェールと緑の眼。罰は、まだない。図鑑の六番である。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">人魂</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            廊に浮かぶ色炎は、敵ではない。触れても器は棄てられない。ゲーミングの色で燃え、近くの輪郭を少し返す。灯の代わりではない。道標に近い。
          </p>
        </section>

        <section className="border-line mt-5 border-t pt-5">
          <h2 className="font-display text-lg">名</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            連携すれば、あなたの名を変えられる。拾得と脱出は、何月何日の何時に、何処で、何を手にしたかとして残る。名を残さない探索は、廃墟と同じく、規格の外で消える。
          </p>
        </section>

        <Link to="/" className="btn-primary mt-8 flex w-full items-center justify-center">
          入口に戻る
        </Link>
        <Link to="/terms" className="btn-ghost mt-2 flex w-full items-center justify-center">
          配信規約（ビデオポリシー）
        </Link>

      </article>
    </main>
  );
}

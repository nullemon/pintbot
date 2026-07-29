#!/usr/bin/env python3
"""
Generates the Japanese edition of the site into site/ja/.

The chrome (top bar, masthead, footer) is built once here so it cannot drift
between the nine pages, exactly as it is duplicated-but-identical on the English
side. Run from the repository root:

    python3 site-worker/build-ja.py
"""

import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'ja')
BASE = 'https://tokyocopyright.com'

NAV = [
    ('index.html',    'ホーム'),
    ('about.html',    '協議会について'),
    ('members.html',  '会員社'),
    ('services.html', '活動内容'),
    ('public.html',   '一般の皆様へ'),
    ('contact.html',  'お問い合わせ'),
]


def chrome_top(page, title, description, en_page):
    nav = '\n'.join(
        '      <a href="{href}"{cls}>{label}</a>'.format(
            href=href, label=label,
            cls=' class="is-active"' if href == page else '')
        for href, label in NAV)

    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{BASE}/ja/{page}">
<link rel="alternate" hreflang="ja" href="{BASE}/ja/{page}">
<link rel="alternate" hreflang="en" href="{BASE}/{en_page}">
<link rel="alternate" hreflang="x-default" href="{BASE}/{en_page}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{BASE}/ja/{page}">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../{en_page}" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
{nav}
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

'''


FOOTER = '''<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
'''


def page_head(crumb, h1, lede):
    return f'''  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; {crumb}</div>
      <h1>{h1}</h1>
      <p>{lede}</p>
    </div>
  </section>
'''


PAGES = {}

# ---------------------------------------------------------------- index ----
PAGES['index.html'] = dict(
    title='AMRC — アニメ・マンガ権利協議会',
    description='アニメ・マンガ権利協議会（AMRC）は、日本のアニメ・マンガ関連企業による会員制団体です。会員社の作品の違法流通に対し、世界規模で共同対処しています。',
    en='index.html',
    body='''
  <section class="hero">
    <div class="wrap text-center">
      <span class="eyebrow">東京発・世界規模で活動</span>
      <h1>海賊版は、ここで終わる。</h1>
      <div class="rule"></div>
      <p>
        アニメ・マンガ権利協議会（AMRC）は、日本のアニメ・マンガ関連企業による会員制団体です。
        会員社の作品の違法な複製を、一般のウェブサイト、配信ポータル、まとめサイト、ファイルホスト、
        SNS、メッセージングサービスに至るまで検出し、24時間体制で削除しています。
      </p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="members.html">会員社一覧</a>
        <a class="btn btn-ghost" href="services.html">活動内容を見る</a>
      </div>
    </div>
  </section>

  <section class="statement">
    <div class="wrap">
      <h2>
        アニメとマンガは、世界で最も海賊版の被害を受けているコンテンツのひとつです。
        その規模は、一社単独で対応できるものではありません。会員社は
        <strong>共同で</strong>これに向き合い、検出・証拠保全・権利行使を一つの基盤に集約しています。
        ファン個人を提訴することは、一切ありません。
      </h2>
    </div>
  </section>

  <section class="section-tight section-grey">
    <div class="wrap">
      <div class="stats">
        <div class="stat">
          <small>一切行いません</small>
          <div class="figure">なし</div>
          <div class="label">ファンへの法的措置</div>
        </div>
        <div class="stat">
          <small>稼働体制</small>
          <div class="figure">24/7</div>
          <div class="label">年中無休で監視</div>
        </div>
        <div class="stat">
          <small>担当者が確認</small>
          <div class="figure">全件</div>
          <div class="label">判断の分かれる案件</div>
        </div>
        <div class="stat">
          <small>回答の目安</small>
          <div class="figure">1営業日</div>
          <div class="label">異議申立てへの回答</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">活動内容</span>
        <h2>あらゆる流通経路を、一つの基盤で</h2>
        <p>
          違法な複製は一箇所に留まりません。クローラーとフィンガープリント照合が拡散を追跡し、
          実際に削除を実行できる事業者へ通知を届けます。
        </p>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <div class="icon">01</div>
          <h3>継続的なモニタリング</h3>
          <p>
            検索エンジン、配信・アップローダーサイト、トレントインデックス、IPTVポータル、
            SNS動画、クラウドストレージ、非公開のメッセージチャンネルまでを継続的に巡回します。
            新作は公開直後から対象となります。
          </p>
        </div>
        <div class="card">
          <div class="icon">02</div>
          <h3>コンテンツ・フィンガープリント</h3>
          <p>
            映像・音声・誌面画像の特徴量照合により、再エンコード、トリミング、左右反転、
            字幕の焼き込み、再生速度の変更、無関係なタイトルでの再投稿を経ても、
            会員社の作品を特定します。
          </p>
        </div>
        <div class="card">
          <div class="icon">03</div>
          <h3>削除要請の送信</h3>
          <p>
            照合・検証を経た案件について、ホスティング事業者、プラットフォーム、CDN、
            レジストラ、検索エンジンに対し、各国の適用法令に基づく削除要請を、
            相手方の言語で昼夜を問わず送信します。
          </p>
        </div>
        <div class="card">
          <div class="icon">04</div>
          <h3>検索結果からの削除</h3>
          <p>
            侵害URLを検索結果から削除し、海賊版が正規配信より上位に表示される状態を解消します。
          </p>
        </div>
        <div class="card">
          <div class="icon">05</div>
          <h3>同時配信の保護</h3>
          <p>
            最新話の配信や劇場公開については、放映開始の瞬間からリアルタイムで監視し、
            数日ではなく数分単位での対応を目標としています。
          </p>
        </div>
        <div class="card">
          <div class="icon">06</div>
          <h3>証拠保全と報告</h3>
          <p>
            すべての通知・回答・再投稿を、日時とともに記録・保全します。
            報告、交渉、代理人への引き継ぎのいずれにも利用できる形式で保管します。
          </p>
        </div>
      </div>

      <p class="text-center mt-3 mb-0">
        <a class="btn btn-dark" href="services.html">活動内容の詳細</a>
      </p>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">対応の流れ</span>
        <h2>投稿の検出から削除まで</h2>
      </div>
      <div class="steps">
        <div class="step">
          <h3>加入</h3>
          <p>加入時に作品リストと権利の証明をご提出いただき、照合用フィンガープリントと配信スケジュールを登録します。</p>
        </div>
        <div class="step">
          <h3>検出</h3>
          <p>クローラーと照合エンジンが、監視対象のあらゆる経路から複製・類似コンテンツを検出します。</p>
        </div>
        <div class="step">
          <h3>検証</h3>
          <p>検出結果を評価・確認し、正規配信、ライセンス許諾済みの利用、法令上認められる利用を対象外とします。</p>
        </div>
        <div class="step">
          <h3>削除</h3>
          <p>通知を自動送信し、再投稿を捕捉します。結果は会員社のダッシュボードに反映されます。</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <span class="kicker">加入の理由</span>
          <h2>作品だけでなく、ファンも守る権利行使</h2>
          <p>
            アニメとマンガは、ファンによって支えられています。視聴者や読者に向けた権利行使は、
            守るべき作品そのものを傷つけます。そのため会員社は、協議会に対し明確な制約を課しています。
            私たちが対処するのは違法な複製を流通させる仕組みであり、ファンではありません。
          </p>
          <ul class="checklist">
            <li>ファンに対する提訴、警告書の送付、損害賠償請求は一切行いません。</li>
            <li>個人利用者の監視は行いません。公開・半公開の流通のみを対象とします。</li>
            <li>判断の分かれる案件は、送信前に必ず担当者が確認します。</li>
            <li>削除が誤りと思われる場合のため、異議申立ての窓口を明示しています。</li>
          </ul>
          <p class="mb-0"><a href="public.html">私たちの約束を読む →</a></p>
        </div>
        <div class="split-figure">
          <h3>会員社が得られるもの</h3>
          <p>
            社内体制では再投稿の量に対応しきれなくなったとき、そして単独の通知にはない重みを
            共同での行動が持つために、各社は協議会に加入します。
          </p>
          <ul class="checklist">
            <li>年間を通じた大量の通知処理</li>
            <li>30以上の言語・文字体系に対応</li>
            <li>24時間365日の自動運用と、日本時間でのサポート</li>
            <li>主要プラットフォームとの信頼済み報告経路の利用</li>
            <li>自社システムと連携できるAPI・ダッシュボード</li>
            <li>常習的な侵害ネットワークに関する情報の共有</li>
            <li>プラットフォームとの交渉における統一した窓口</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-ink">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">対象範囲</span>
        <h2>保護の対象</h2>
      </div>
      <div class="grid grid-4">
        <div class="card card-flat">
          <h3>放送・同時配信アニメ</h3>
          <p class="small mb-0">毎話の配信、無許諾の字幕・吹替、埋め込みポータル、IPTVによる再配信。</p>
        </div>
        <div class="card card-flat">
          <h3>マンガ・連載作品</h3>
          <p class="small mb-0">生スキャン、無断翻訳版のミラー、まとめサイト、掲載前の流出。</p>
        </div>
        <div class="card card-flat">
          <h3>劇場作品・OVA</h3>
          <p class="small mb-0">劇場公開作品、パッケージのリッピング、BOX商品、試写用素材の流出。</p>
        </div>
        <div class="card card-flat">
          <h3>音楽・音声作品</h3>
          <p class="small mb-0">主題歌、サウンドトラック、ドラマCD、未発表音源。</p>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>加入をご検討中ですか</h2>
      <p>
        作品名をお知らせいただければ、現在どこで違法に流通しているかを調査し、
        加入によって何が対象となるかをご報告します。費用や義務は発生しません。
      </p>
      <a class="btn" href="contact.html">侵害状況の調査を依頼する</a>
    </div>
  </section>
''')

# ---------------------------------------------------------------- about ----
PAGES['about.html'] = dict(
    title='協議会について — AMRC',
    description='アニメ・マンガ権利協議会の成り立ち、活動の原則、運営体制、および加入の手続きについてご説明します。',
    en='about.html',
    body=page_head('協議会について', '協議会について',
                   '日本のアニメ・マンガ関連企業による会員制団体として、会員社が共同で利用する技術基盤を運営しています。') + '''
  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <span class="kicker">私たちについて</span>
          <h2>法律事務所ではなく、共同の権利行使機関です</h2>
          <p>
            協議会は、ひとつの認識から生まれました。海賊版対策における制約は法制度ではなく、
            処理能力にあるということです。人気作品は一週間のうちに、数十のプラットフォームで
            数千回も再投稿されます。この量に単独で対応できる企業はなく、
            各社が個別に費用を負担しながら、同じ戦いに敗れ続けていました。
          </p>
          <p>
            そこで会員社は、ひとつの処理基盤を構築し、共同で利用することにしました。
            クローラー、フィンガープリント照合、通知送信は全作品を横断して稼働し続け、
            担当者は人の判断を要する案件——判定が分かれるもの、常習的な侵害者、
            要請に応じない事業者、掲載前の流出——に専念します。
          </p>
          <p class="mb-0">
            協議会は会員社の顧問弁護士と連携して活動します。これに代わるものではなく、
            法的助言を行うものでもありません。
          </p>
        </div>
        <div class="split-figure">
          <h3>概要</h3>
          <ul class="checklist">
            <li>事務局：東京都千代田区</li>
            <li>年中無休・24時間体制での権利行使</li>
            <li>30以上の言語で通知を送信</li>
            <li>会員社：アニメ制作会社、マンガ出版社、ライセンサー</li>
            <li>対応言語：日本語・英語</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">活動の原則</span>
        <h2>私たちが定めている制約</h2>
        <p>以下は宣伝文句ではなく、協議会を拘束する規則です。会員社の要請であっても、これを超えて行動することはありません。</p>
      </div>
      <div class="grid grid-3">
        <div class="card">
          <h3>ファンを対象としない</h3>
          <p>
            視聴者・読者・聴取者に対する提訴、請求、警告、督促は行いません。
            対象とするのは違法な複製の流通であり、受け手ではありません。
          </p>
        </div>
        <div class="card">
          <h3>量より正確性</h3>
          <p>
            誤った削除は正当な表現を奪い、会員社の信用を損ないます。
            照合の確度基準、ライセンシーの除外リスト、判断が分かれる案件の人による確認を、
            処理過程に組み込んでいます。
          </p>
        </div>
        <div class="card">
          <h3>段階的な対応</h3>
          <p>
            まず直接対処できるホスティング事業者・プラットフォームに要請し、
            応じられない場合に限り、レジストラ、決済事業者、検索エンジンへ段階を上げます。
          </p>
        </div>
        <div class="card">
          <h3>権利の確認を前提に</h3>
          <p>
            通知を一件でも送る前に、会員社が主張する権利を、主張する地域について実際に
            保有しているかを確認します。海外ライセンシーによる同時配信の権利関係も含みます。
          </p>
        </div>
        <div class="card">
          <h3>相手方への透明性</h3>
          <p>
            すべての通知に、送信者、依頼元、対象作品、法的根拠を明記し、
            異議がある場合の申立方法を案内しています。
          </p>
        </div>
        <div class="card">
          <h3>データの最小化</h3>
          <p>
            侵害の立証に必要な証拠のみを記録し、それ以上は収集しません。
            個人の利用者のプロファイルを作成することはありません。
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">
      <span class="kicker">加入について</span>
      <h2>加入までの流れ</h2>
      <p>
        多くの場合、まず侵害状況の調査から始まります。加入をご検討の企業から数作品をお預かりし、
        現在どこで、どの程度の規模で違法に流通しているかをご報告します。
        この報告書は、加入されるかどうかにかかわらずお渡しします。
      </p>
      <p>
        お進みいただく場合、加入手続きは数日で完了します。作品リストと権利の証明をお預かりし、
        照合用フィンガープリントを生成し、同時配信・連載のスケジュールを登録します。
        これにより、最新話や新章は公開の瞬間から保護対象となります。あわせて、
        ダッシュボードとAPIの認証情報を発行します。
      </p>
      <p>
        以後、システムは自動で稼働します。会員社には定期報告、検出・削除状況のリアルタイム表示、
        権利行使方針を決定する会員総会での議決権、そして人の対応が必要な場合の
        東京の専任担当者が提供されます。
      </p>

      <div class="notice mt-2">
        <p>
          <strong>ご留意ください：</strong>協議会は会員社に対し技術的な権利行使業務を提供します。
          法律事務所ではなく、本サイトの記載は法的助言を構成するものではありません。
          訴訟が適切な場合には、会員社の代理人に対し証拠と報告を提供して支援します。
        </p>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">運営体制</span>
        <h2>協議会の運営</h2>
        <p>協議会は会員社から与えられた権限の範囲でのみ活動します。その権限は、明文化されています。</p>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <h3>会員総会</h3>
          <p>
            正会員は保有作品の規模にかかわらず、一社一議決権を有します。
            総会は権利行使方針を定め、新規会員を承認し、予算を議決します。
          </p>
        </div>
        <div class="card">
          <h3>事務局</h3>
          <p>
            千代田区の常設チームが、総会の定めた方針の範囲内で日々の権利行使を担います。
            事務局の判断で対象範囲を広げることはできません。
          </p>
        </div>
        <div class="card">
          <h3>権利行使規程</h3>
          <p>
            前掲の原則は協議会の規程に明記されています。会員社が事務局に対し、
            ファンへの措置や、権利を有しない作品についての通知を指示することはできません。
          </p>
        </div>
      </div>

      <div class="notice notice-info mt-3">
        <p class="mb-0">
          <strong>追記予定：</strong>協議会の法人格（一般社団法人その他）、設立年月日、
          役員構成、定款へのリンク。代表者は<a href="imprint.html">運営者情報</a>に記載しています。
        </p>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>作品の被害状況をご確認になりますか</h2>
      <p>数作品をお知らせいただければ、調査のうえ書面でご報告します。</p>
      <a class="btn" href="contact.html">調査を依頼する</a>
    </div>
  </section>
''')

# -------------------------------------------------------------- members ----
PAGES['members.html'] = dict(
    title='会員社 — AMRC',
    description='アニメ・マンガ権利協議会を構成するアニメ制作会社、マンガ出版社、ライセンサーの一覧です。',
    en='members.html',
    body=page_head('会員社', '会員社',
                   '協議会は、以下のアニメ制作会社・マンガ出版社・ライセンサーを代理して活動します。各社は特定の作品について権利行使を委任しています。') + '''
  <section class="section">
    <div class="wrap">

      <div class="notice">
        <p class="mb-0">
          <strong>会員社一覧は未掲載です。</strong>下記のリストに一社ずつ
          <code>&lt;li&gt;</code> として追加し、見出しの社数を更新してください。
          掲載は、各社から書面による同意を得たうえで行ってください。
          公開時にはこの注意書きを削除してください。
        </p>
      </div>

      <div class="section-title mt-3">
        <span class="kicker">会員構成</span>
        <h2>協議会が代理する企業</h2>
        <p>
          正会員は保有作品を協議会に委任し、会員総会に議席を有し、権利行使規程に拘束されます。
        </p>
      </div>

      <div class="roster-group">
        <div class="roster-head">
          <h3>マンガ出版社</h3>
          <span class="count">&mdash; 社</span>
        </div>
        <ul class="roster">
          <!-- 出版社をここに追加してください（一社一行）:
               <li><span class="name">株式会社◯◯</span><span class="meta">2024年より</span></li>
               .meta は省略可能です。 -->
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
        </ul>
      </div>

      <div class="roster-group">
        <div class="roster-head">
          <h3>アニメ制作会社</h3>
          <span class="count">&mdash; 社</span>
        </div>
        <ul class="roster">
          <!-- 制作会社をここに追加してください。形式は上記と同じです。 -->
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap prose">
      <span class="kicker">掲載の意味</span>
      <h2>会員であることが示す範囲</h2>
      <p>
        この一覧は、プラットフォームやホスティング事業者が、当協議会からの通知が正当な権限に
        基づくものかを確認するための情報です。そのため、何を示すものかを明確にしておきます。
      </p>
      <ul class="checklist">
        <li>掲載各社は、委任した作品について協議会を代理人として指名しています。それ以上の権限はありません。</li>
        <li>会員となることで著作権が移転することはありません。各作品の権利は権利者に帰属したままです。</li>
        <li>会員社のライセンシーおよび正規配信経路は除外リストに登録され、対象となることはありません。</li>
        <li>協議会は会員社以外を代理せず、業界全体を代表するものでもありません。</li>
        <li>掲載の社名および標章は各社に帰属し、許諾を得て表示しています。</li>
      </ul>

      <div class="notice notice-info">
        <p class="mb-0">
          通知の正当性を確認されるプラットフォームの担当者様は、通知に記載の参照番号を添えて
          <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
          までご連絡ください。当該作品についての委任状況をご回答します。
        </p>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>加入をご検討の企業様へ</h2>
      <p>
        貴社作品の現在の違法流通状況を調査し、加入によって何が対象となるかをご説明します。
        費用や義務は発生しません。
      </p>
      <a class="btn" href="contact.html">加入について問い合わせる</a>
    </div>
  </section>
''')


# ------------------------------------------------------------- services ----
PAGES['services.html'] = dict(
    title='活動内容 — AMRC',
    description='モニタリング、フィンガープリント照合、削除要請、検索結果からの削除、同時配信の保護、証拠保全と報告。会員社のために協議会が行う業務です。',
    en='services.html',
    body=page_head('活動内容', '活動内容',
                   '協議会が会員社のために行う業務です。個別の対応を積み重ねるのではなく、検出・検証・削除・報告を一続きの処理として継続的に運用しています。') + '''
  <section class="section">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">主な業務</span>
        <h2>会員社の作品を守るために必要なすべて</h2>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="icon">M</div>
          <h3>継続的なモニタリング</h3>
          <p>違法な複製が実際に流通する経路を、それぞれの更新頻度に合わせて巡回します。</p>
          <ul class="checklist">
            <li>配信・埋め込みポータル、IPTVおよび再配信サービス</li>
            <li>アップローダー、ファイルホスト、公開設定のクラウドストレージ</li>
            <li>トレントインデックス、DHT、Usenetインデクサ</li>
            <li>SNS動画、ショート動画プラットフォーム、掲示板</li>
            <li>公開メッセージチャンネル、リンクまとめサイト</li>
            <li>作品名による検索結果</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">F</div>
          <h3>コンテンツ・フィンガープリント</h3>
          <p>ファイル名による照合は容易に回避されます。内容そのものを照合するため、改変後も特定できます。</p>
          <ul class="checklist">
            <li>再エンコードやトリミングに耐える映像の知覚ハッシュ</li>
            <li>楽曲、吹替、オーディオ作品の音声フィンガープリント</li>
            <li>出版物・マンガ向けの画像およびテキスト類似度判定</li>
            <li>左右反転、速度変更、レターボックス、字幕焼き込みの検出</li>
            <li>切り抜き・まとめ動画に対する部分一致判定</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">T</div>
          <h3>削除要請と通知管理</h3>
          <p>検証済みの案件について、実際に対処できる相手方へ、適用される法令に基づいて通知します。</p>
          <ul class="checklist">
            <li>米国所在のサービス・検索エンジンへのDMCA通知</li>
            <li>日本法、EU法その他各国制度に基づく通知</li>
            <li>信頼済み報告者制度を通じたプラットフォームへの直接申告</li>
            <li>ホスティング事業者、CDN、レジストラ、決済事業者への段階的対応</li>
            <li>再投稿の自動再通知</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">D</div>
          <h3>検索結果からの削除</h3>
          <p>ファイルを削除しても、海賊版サイトが正規配信より上位に残れば対策は半分です。検索面にも並行して対応します。</p>
          <ul class="checklist">
            <li>主要検索エンジンに対する侵害URLの削除申請</li>
            <li>作品名・ブランド名の検索結果の監視</li>
            <li>ドメイン変更とミラーサイト網の追跡</li>
            <li>正規ページの表示順位回復状況の報告</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">L</div>
          <h3>同時配信・公開前の保護</h3>
          <p>最も価値の高い時間帯は、最も短い時間帯でもあります。専用の即応体制で対応します。</p>
          <ul class="checklist">
            <li>同時配信期間中のリアルタイム監視</li>
            <li>検出から数分単位での対応を目標</li>
            <li>対応形式に応じた電子透かしによる流出元の特定</li>
            <li>放映・掲載開始前の事前巡回</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">R</div>
          <h3>証拠保全・報告・API</h3>
          <p>処理の全過程を記録し、立証と次の判断に使える形で保管します。</p>
          <ul class="checklist">
            <li>日時を記録した証拠一式と取得時の保全データ</li>
            <li>検出・通知・削除結果のダッシュボード表示</li>
            <li>経営層およびライセンサー向けの定期報告</li>
            <li>自社システムと連携するREST APIおよびWebhook</li>
            <li>常習的侵害者・非協力的事業者に関する情報</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">会員種別</span>
        <h2>提供内容の区分</h2>
        <p>目安です。実際の対象範囲は、作品数、公開頻度、対象地域に応じて個別に設定します。</p>
      </div>

      <div class="table-scroll">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              <th scope="col">準会員</th>
              <th scope="col">正会員</th>
              <th scope="col">同時配信対応</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">監視頻度</th>
              <td>1日1回</td>
              <td>常時</td>
              <td>常時＋リアルタイム対応</td>
            </tr>
            <tr>
              <th scope="row">照合方式</th>
              <td>映像・音声</td>
              <td>映像・音声・画像・テキスト</td>
              <td>全方式＋部分一致</td>
            </tr>
            <tr>
              <th scope="row">検索結果の削除</th>
              <td>対象</td>
              <td>対象</td>
              <td>対象＋キーワード監視</td>
            </tr>
            <tr>
              <th scope="row">対応目標</th>
              <td>24時間以内</td>
              <td>2時間以内</td>
              <td>配信期間中は数分単位</td>
            </tr>
            <tr>
              <th scope="row">報告</th>
              <td>月次</td>
              <td>週次＋ダッシュボード</td>
              <td>リアルタイム表示・API・Webhook</td>
            </tr>
            <tr>
              <th scope="row">サポート</th>
              <td>メール</td>
              <td>専任担当者</td>
              <td>専任担当者＋緊急連絡体制</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-center mt-3 mb-0">
        <a class="btn btn-dark" href="contact.html">ご要望を相談する</a>
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">
      <span class="kicker">よくあるご質問</span>
      <h2>お問い合わせの多い点</h2>
      <div class="faq mt-2">
        <details>
          <summary>実際にどのくらいで削除されますか</summary>
          <p>
            相手方によります。信頼済み報告者制度のある大手プラットフォームでは数時間、
            小規模な事業者ではより時間を要し、一部は通知に応じません。
            応じない場合は上位のプロバイダ、レジストラ、決済事業者へ段階を上げます。
            報告では平均値ではなく、実際の分布をお示しします。
          </p>
        </details>
        <details>
          <summary>削除しても再投稿された場合は</summary>
          <p>
            再投稿は想定内であり、自動で処理されます。作品のフィンガープリントを登録済みであれば、
            新たな複製は次回の巡回で検出され、改めて申請いただくことなく再通知されます。
            繰り返す投稿者は常習的侵害者として記録します。
          </p>
        </details>
        <details>
          <summary>正当なコンテンツを誤って削除する可能性は</summary>
          <p>
            可能性をゼロにはできないため、そうならない設計にしています。ライセンシーおよび
            提携先のURLは除外リストに登録し、照合の確度基準は厳しめに設定し、
            判断が分かれる案件は人が確認し、批評・論評その他の正当な利用は対象外としています。
            影響を受けた方は異議を申し立てられます。手順は
            <a href="public.html#counter-notice">一般の皆様へ</a>のページに記載しています。
          </p>
        </details>
        <details>
          <summary>個々の視聴者に対して措置を取りますか</summary>
          <p>
            行いません。ファンに対する提訴、請求、警告書の送付は一切なく、
            協議会の規程上、会員社がそれを指示することもできません。
            権利行使の対象は違法な複製の流通です。
          </p>
        </details>
        <details>
          <summary>対象地域はどこまでですか</summary>
          <p>
            検出は全世界を対象とします。通知は相手方に適用される制度——米国所在のサービスには
            DMCA、必要に応じて日本およびEUの手続、その他の地域ではプラットフォームの規約——
            に従って送信します。通知は30以上の言語で対応しています。
          </p>
        </details>
        <details>
          <summary>加入にあたって必要なものは</summary>
          <p>
            作品リスト、権利を保有していることの証明、同時配信・連載のスケジュール、
            および除外リストに登録するための正規配信URL（海外ライセンシーを含む）です。
            参照用の素材があれば照合精度が上がりますが、必須ではありません。
          </p>
        </details>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>加入をご検討中ですか</h2>
      <p>保護をご希望の作品をお知らせいただければ、対象範囲をご提案します。</p>
      <a class="btn" href="contact.html">事務局に問い合わせる</a>
    </div>
  </section>
''')

# --------------------------------------------------------------- public ----
PAGES['public.html'] = dict(
    title='一般の皆様へ — AMRC',
    description='プラットフォーム事業者、ホスティング事業者、投稿者の皆様へ。当協議会の通知の内容、対応方法、異議申立ての手順をご案内します。',
    en='public.html',
    body=page_head('一般の皆様へ', '一般の皆様へ',
                   'プラットフォーム運営者、ホスティング事業者、サイト管理者、投稿者の皆様、および当協議会の通知を受け取られた方、活動内容をお知りになりたい方に向けたご案内です。') + '''
  <section class="section-tight section-grey">
    <div class="wrap">
      <div class="stats">
        <div class="stat">
          <small>一切ありません</small>
          <div class="figure">0件</div>
          <div class="label">ファンへの法的請求</div>
        </div>
        <div class="stat">
          <small>担当者が確認</small>
          <div class="figure">全件</div>
          <div class="label">判断の分かれる案件</div>
        </div>
        <div class="stat">
          <small>誤りが判明した場合</small>
          <div class="figure">撤回</div>
          <div class="label">直ちに取り下げます</div>
        </div>
        <div class="stat">
          <small>回答の目安</small>
          <div class="figure">1営業日</div>
          <div class="label">異議申立てへの回答</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <span class="kicker">私たちの約束</span>
      <h2>行うこと、行わないこと</h2>
      <p>
        海賊版対策は、何も悪いことをしていない方を含め、現実の人々に影響します。
        そのため、私たちが自らに課している制約を公開しています。
      </p>
      <ul class="checklist">
        <li><strong>ファンを対象としません。</strong>視聴者・読者・聴取者に対する提訴、和解金の請求、督促、警告書の送付は行いません。</li>
        <li><strong>正当な利用を対象としません。</strong>批評、論評、パロディ、報道、教育目的その他法令上認められる利用は、権利行使の対象外です。</li>
        <li><strong>権利を確認してから行動します。</strong>会員社が主張する権利を保有していることを確認するまで、通知は送信しません。</li>
        <li><strong>差出人を明示します。</strong>すべての通知に、送信者、依頼元、対象作品、法的根拠を記載しています。</li>
        <li><strong>誤りを認めます。</strong>削除が誤りであったと示された場合、速やかに、争わずに是正します。</li>
        <li><strong>データを最小限にします。</strong>侵害の立証に必要な記録のみを保持し、個人のプロファイルは作成しません。</li>
      </ul>

      <hr>

      <span class="kicker">事業者の皆様へ</span>
      <h2>当協議会から通知を受け取られた場合</h2>
      <p>
        当協議会の通知は自動生成されますが、一件ごとに検証されています。通知には、
        対象作品の特定情報、侵害しているURLまたはファイル、依頼元の会員社、法的根拠、
        連絡先、および固有の参照番号が記載されています。
      </p>
      <p>
        最も早い解決方法は、記載のURLに対処し、参照番号を添えて通知記載のアドレスへご返信いただくことです。
        通知の内容に誤りがあるとお考えの場合は、その旨をお知らせください。
        誤った通知が実行されるより、撤回する方を望みます。
      </p>
      <p>
        利用者投稿の多いサービスを運営されている場合、メールに代えて直接または自動での報告経路を
        設定することも可能です。件名を「プラットフォーム連携」として
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> までご連絡ください。
      </p>

      <hr>

      <h2 id="counter-notice">異議申立ての手順</h2>
      <p>
        当協議会の通知によりコンテンツが削除され、その削除が誤りであるとお考えの場合——
        権利を保有している、許諾を得ている、または法令上認められる利用である場合——
        異議を申し立てることができます。削除を行ったプラットフォームを通じてでも、
        当協議会へ直接でも構いません。
      </p>
      <p>
        当協議会へ申し立てる場合は、件名を<strong>「異議申立て」</strong>として
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> 宛に、
        以下をご記載のうえご連絡ください。
      </p>
      <ol>
        <li>通知に記載された参照番号（お分かりになる場合）</li>
        <li>削除された対象の正確なURLまたは識別情報</li>
        <li>お名前、およびご連絡可能な住所・メールアドレス</li>
        <li>削除が誤りであるとお考えの理由（権利の保有、許諾の有無、認められる利用である旨など）</li>
        <li>これを裏付ける資料（許諾契約、契約書、リリース等）</li>
      </ol>
      <p>
        1営業日以内（日本時間）の回答、および5営業日以内の解決を目標としています。
        通知が誤りであったと判断した場合は、これを撤回し、プラットフォームに復旧を要請します。
        見解が異なる場合は、その理由を書面でお伝えします。プラットフォームまたは
        ご自身の法律顧問を通じて、さらに手続を進めていただくことができます。
      </p>

      <div class="notice notice-info">
        <p>
          異議申立てには法的な効果が生じる場合があり、プラットフォームによっては
          連絡先が権利者に開示されることがあります。本記載は法的助言ではありません。
          ご不明な点は、お住まいの地域の弁護士にご相談ください。
        </p>
      </div>

      <hr>

      <span class="kicker">権利者の皆様へ</span>
      <h2>ご自身の作品の被害を報告する</h2>
      <p>
        権利者の方で、ご自身の作品が違法に流通しているのを見つけられた場合は、
        <a href="contact.html">お問い合わせフォーム</a>または
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> までご連絡ください。
        作品名、権利を保有していることの証明、すでに把握されているURLをお知らせいただけると助かります。
      </p>
      <p>
        当協議会が代理できるのは会員社に限られますが、取り得る選択肢をお伝えし、
        当協議会の対象外の事案については適切な窓口をご案内します。
        加入により対応可能となるかどうかも、あわせてお答えします。
      </p>

      <hr>

      <span class="kicker">報道・研究の皆様へ</span>
      <h2>取材・研究のお問い合わせ</h2>
      <p>
        オンライン海賊版、プラットフォームの責任、通知実務について取材・研究をされている
        記者・研究者の方は、<a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        までご連絡ください。手法および集計値については通常お話しできますが、
        会員社の個別情報および案件の詳細は非公開です。
      </p>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>その他のお問い合わせ</h2>
      <p>通知、異議申立て、プラットフォーム連携、取材——いずれも同じ窓口で承ります。</p>
      <a class="btn" href="contact.html">お問い合わせ</a>
    </div>
  </section>
''')

# -------------------------------------------------------------- contact ----
PAGES['contact.html'] = dict(
    title='お問い合わせ — AMRC',
    description='アニメ・マンガ権利協議会へのお問い合わせ。加入のご相談、侵害の報告、異議申立て、取材：legal@tokyocopyright.com / 03-3230-6016',
    en='contact.html',
    body=page_head('お問い合わせ', 'お問い合わせ',
                   '加入のご相談、侵害の報告、通知に関する異議申立て、取材のいずれも、以下の窓口で承ります。日本語・英語のどちらでもお受けしています。') + '''
  <section class="section">
    <div class="wrap">
      <div class="split split-top">

        <div>
          <span class="kicker">お問い合わせフォーム</span>
          <h2>ご用件をお聞かせください</h2>
          <p>
            保護をご希望の内容、または解決をご希望の事項をお知らせください。
            加入に関するお問い合わせには、1営業日以内（日本時間）にご返信します。
          </p>

          <form id="contact-form"
                method="post"
                action="../contact.php"
                data-endpoint="../contact.php"
                data-mailbox="legal@tokyocopyright.com"
                novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="f-name">お名前 <span class="req">*</span></label>
                <input id="f-name" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="field">
                <label for="f-company">会社・団体名</label>
                <input id="f-company" name="company" type="text" autocomplete="organization">
              </div>
              <div class="field">
                <label for="f-email">メールアドレス <span class="req">*</span></label>
                <input id="f-email" name="email" type="email" autocomplete="email" required>
              </div>
              <div class="field">
                <label for="f-phone">電話番号</label>
                <input id="f-phone" name="phone" type="tel" autocomplete="tel">
              </div>
              <div class="field">
                <label for="f-subject">お問い合わせ区分</label>
                <select id="f-subject" name="subject">
                  <option>加入について</option>
                  <option>侵害状況の調査依頼</option>
                  <option>自社作品の侵害報告</option>
                  <option>異議申立て・削除への不服</option>
                  <option>プラットフォーム／ホスティング事業者</option>
                  <option>取材・研究</option>
                  <option>その他</option>
                </select>
              </div>
              <div class="field">
                <label for="f-rights">作品の種別</label>
                <select id="f-rights" name="rights">
                  <option>アニメ — 放送・同時配信</option>
                  <option>アニメ — 劇場作品・OVA</option>
                  <option>マンガ・連載作品</option>
                  <option>ライトノベル・出版物</option>
                  <option>音楽・サウンドトラック・ドラマCD</option>
                  <option>商品・公式イラスト</option>
                  <option>該当なし</option>
                </select>
              </div>
              <div class="field field-full">
                <label for="f-message">お問い合わせ内容 <span class="req">*</span></label>
                <textarea id="f-message" name="message" required
                  placeholder="対象作品、すでに把握されているURL、ご希望の対応内容をご記入ください。"></textarea>
                <span class="hint">パスワードや試写用の認証情報など、秘匿すべき情報は記入しないでください。</span>
              </div>

              <div class="field field-trap" aria-hidden="true">
                <label for="f-website">この欄は空欄のままにしてください</label>
                <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
              </div>

              <div class="field-check">
                <input id="f-consent" name="consent" type="checkbox" value="yes" required>
                <label for="f-consent">
                  本お問い合わせへの回答のため、当協議会が上記の情報を保管・利用することに同意します
                  （<a href="privacy.html">プライバシーポリシー</a>）。<span class="req">*</span>
                </label>
              </div>
            </div>

            <p class="mt-2">
              <button class="btn btn-primary" type="submit">送信する</button>
            </p>
            <div id="form-status" class="form-status"></div>
            <noscript>
              <div class="notice mt-2">
                <p>
                  このフォームの送信にはJavaScriptが必要です。
                  <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
                  まで直接メールでご連絡ください。
                </p>
              </div>
            </noscript>
          </form>
        </div>

        <div>
          <div class="card">
            <span class="kicker">事務局</span>
            <h3>アニメ・マンガ権利協議会</h3>
            <dl class="deflist">
              <dt>所在地</dt>
              <dd>
                〒101-8050<br>
                東京都千代田区一ツ橋4-6-10
              </dd>
              <dt>メール</dt>
              <dd><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></dd>
              <dt>電話</dt>
              <dd><a href="tel:+81332306016">03-3230-6016</a><br>
                  <span class="small muted">海外から：+81 3-3230-6016</span></dd>
              <dt>受付時間</dt>
              <dd>平日 9:00–18:00（日本時間）<br>
                  <span class="small muted">監視システムは24時間稼働しています</span></dd>
              <dt>対応言語</dt>
              <dd>日本語・English</dd>
            </dl>
          </div>

          <div class="card mt-2">
            <h3>ご用件別の窓口</h3>
            <ul class="checklist mb-0">
              <li><strong>加入・調査依頼</strong> — 本フォーム、または上記アドレスへ。</li>
              <li><strong>削除への不服</strong> — 件名を<em>「異議申立て」</em>としてメールを。手順は<a href="public.html#counter-notice">こちら</a>。</li>
              <li><strong>プラットフォーム事業者</strong> — 件名を<em>「プラットフォーム連携」</em>として、直接報告の設定をご相談ください。</li>
              <li><strong>取材・研究</strong> — 件名を<em>「取材」</em>としてご連絡ください。</li>
            </ul>
          </div>

          <div class="notice notice-info mt-2">
            <p class="mb-0">
              <strong>会員社作品の侵害を報告される場合</strong>は、作品名、分かる範囲での権利者、
              すでに把握されているURLをお知らせください。初回のご返信で対応に着手できます。
            </p>
          </div>
        </div>

      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">所在地</span>
        <h2>東京都千代田区</h2>
        <p>
          事務局は千代田区一ツ橋にあります。ご来訪は事前予約制です。
          あらかじめメールにてご連絡ください。
        </p>
      </div>
      <p class="text-center mb-0">
        <a class="btn btn-dark"
           href="https://www.google.com/maps/search/?api=1&amp;query=東京都千代田区一ツ橋4-6-10"
           target="_blank" rel="noopener noreferrer">地図で見る</a>
      </p>
    </div>
  </section>
''')

# -------------------------------------------------------------- imprint ----
PAGES['imprint.html'] = dict(
    title='運営者情報 — AMRC',
    description='アニメ・マンガ権利協議会の運営者情報、免責事項、著作権表示。',
    en='imprint.html',
    body=page_head('運営者情報', '運営者情報', '本サイトの運営者に関する情報および法的表示です。') + '''
  <section class="section">
    <div class="wrap prose">

      <h2 class="mt-0">運営者</h2>
      <dl class="deflist">
        <dt>名称</dt>
        <dd>アニメ・マンガ権利協議会（AMRC）<br>
          <span class="small muted">Anime &amp; Manga Rights Council</span></dd>
        <dt>所在地</dt>
        <dd>
          〒101-8050<br>
          東京都千代田区一ツ橋4-6-10
        </dd>
        <dt>メール</dt>
        <dd><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></dd>
        <dt>電話</dt>
        <dd><a href="tel:+81332306016">03-3230-6016</a></dd>
        <dt>代表取締役</dt>
        <dd>Akihito Fukuhara<br>
          <span class="small muted">漢字表記は追記予定</span></dd>
        <dt>代表者</dt>
        <dd>Ken Ishikawa<br>
          <span class="small muted">漢字表記は追記予定</span></dd>
        <dt>事業内容</dt>
        <dd>会員社を代理する著作権保護および海賊版対策業務</dd>
        <dt>本サイトの管理責任者</dt>
        <dd>Ken Ishikawa（上記所在地）</dd>
      </dl>

      <div class="notice mt-2">
        <p class="mb-0">
          <strong>追記予定：</strong>法人格（一般社団法人その他）、法人番号、
          該当する場合は適格請求書発行事業者登録番号、および役員の漢字表記。
          特定商取引法の適用がある場合、これらの記載が必要となります。
        </p>
      </div>

      <h2>免責事項</h2>

      <h3>掲載内容について</h3>
      <p>
        本サイトの内容は、当協議会の活動に関する一般的な情報提供を目的としています。
        正確かつ最新の状態を保つよう努めていますが、内容の完全性、正確性、
        最新性を保証するものではありません。本サイトの記載は法的助言を構成せず、
        契約の申込みまたは業務提供の確定的な申出を構成するものでもありません。
      </p>

      <h3>外部リンクについて</h3>
      <p>
        本サイトから外部サイトへリンクしている場合、当該サイトは当協議会の管理下にありません。
        掲載時に確認は行っていますが、外部サイトの内容について責任を負いかねます。
        本サイトからのリンク先に違法な内容があるとお気づきの場合は、ご連絡いただければ削除します。
      </p>

      <h3>本サイトの著作権</h3>
      <p>
        本サイトの文章、レイアウト、図版、コードは著作権により保護されており、
        特段の記載がない限りアニメ・マンガ権利協議会に帰属します。
        著作権法上認められる範囲を超える複製、翻案、頒布には、事前の書面による許諾が必要です。
        私的かつ非商業的な利用は認められます。
      </p>

      <h3>商標について</h3>
      <p>
        本サイトに記載の製品名、会社名、標章は各権利者に帰属し、識別のためにのみ使用しています。
        使用は、推奨または提携関係を意味するものではありません。
      </p>

      <h2>当協議会への通知</h2>
      <p>
        本サイトの掲載内容に関するものを含む正式なご通知は、
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        または上記所在地宛にご送付ください。当協議会が送信した削除要請に異議がある場合は、
        <a href="public.html#counter-notice">一般の皆様へ</a>のページに記載の手順に従ってください。
      </p>

      <h2>個人情報の取扱い</h2>
      <p>
        個人情報の取扱いについては<a href="privacy.html">プライバシーポリシー</a>をご覧ください。
      </p>

      <p class="small muted mt-3">最終更新：<span data-year>2026</span>年</p>
    </div>
  </section>
''')

# -------------------------------------------------------------- privacy ----
PAGES['privacy.html'] = dict(
    title='プライバシーポリシー — AMRC',
    description='アニメ・マンガ権利協議会における個人情報の取得、利用、保管、保護の方針。',
    en='privacy.html',
    body=page_head('プライバシーポリシー', 'プライバシーポリシー',
                   '本サイトおよび当協議会の業務における個人情報の取扱いについてご説明します。') + '''
  <section class="section">
    <div class="wrap prose">

      <div class="notice">
        <p class="mb-0">
          <strong>公開前に：</strong>本ポリシーは、個人情報保護法（APPI）および、
          EU・英国の関係者を扱う場合はGDPRに照らし、顧問弁護士の確認を受けてください。
          利用しているホスティング事業者、実際に導入する解析ツール、保存期間を記載してください。
        </p>
      </div>

      <h2>1. 事業者</h2>
      <p>
        アニメ・マンガ権利協議会（〒101-8050 東京都千代田区一ツ橋4-6-10）が、
        本サイトを通じて取得する個人情報について責任を負います。本ポリシーまたは
        個人情報に関するお問い合わせは、
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        または <a href="tel:+81332306016">03-3230-6016</a> までご連絡ください。
      </p>

      <h2>2. 取得する情報</h2>

      <h3>2.1 本サイトのご利用時</h3>
      <p>
        ページの要求時に、ホスティング事業者が標準的なサーバーログを記録します。
        要求元のIPアドレス、日時、要求されたページ、参照元ページ、
        ブラウザおよびOSの情報が含まれます。これはサイトの提供と、
        不正利用・技術的障害の検知に必要なものです。ログは短期間の保存後に削除されます。
      </p>

      <h3>2.2 お問い合わせフォームのご利用時</h3>
      <p>
        ご入力いただいたお名前、会社・団体名、メールアドレス、電話番号（ご記入の場合）、
        お問い合わせ区分、内容を取得します。これらはご回答および、
        その後の取引関係の管理のためにのみ利用します。取引に至らなかった場合、
        必要がなくなった時点で削除します。
      </p>

      <h3>2.3 権利行使業務において</h3>
      <p>
        侵害コンテンツの検出および対応にあたり、公開されている掲載情報について証拠を記録します。
        URL、ファイル識別情報、ページの内容、日時、および表示されている投稿者名が含まれ、
        これらは個人情報に該当し得ます。当協議会は、個々の視聴者を特定しようとせず、
        通信事業者から契約者情報を取得せず、利用者の行動プロファイルを作成しません。
      </p>

      <h3>2.4 クッキーおよびアクセス解析</h3>
      <p>
        本サイトは広告クッキーおよび第三者によるトラッキングクッキーを使用していません。
        アクセス解析を利用する場合は、プライバシーに配慮した方式とし、
        サイトを跨いだ追跡は行いません。同意が必要な場合は、
        必須でないクッキーの設定前に同意を取得します。
      </p>

      <h2>3. 利用目的</h2>
      <ul>
        <li>お問い合わせへの回答のため。</li>
        <li>契約の履行、または契約締結に向けた準備のため。</li>
        <li>サイトの安全な運営および著作権の保護という、当協議会および会員社の正当な利益のため。</li>
        <li>記録保存および適法な請求への対応を含む、法令上の義務の履行のため。</li>
        <li>ご同意をいただいた場合、その際にお示しした目的のため。</li>
      </ul>

      <h2>4. 第三者提供</h2>
      <p>個人情報を販売することはありません。必要な範囲でのみ提供します。</p>
      <ul>
        <li>サイトのホスティング、メール送信、データ保管を行う委託先（契約に基づき、当協議会の指示の範囲で）</li>
        <li>個別の権利行使を依頼した会員社</li>
        <li>削除要請の性質上、対象物および通知者を特定する必要がある範囲で、プラットフォームおよびホスティング事業者</li>
        <li>必要な場合、当協議会の専門家（弁護士等）</li>
        <li>法令に基づき求められる場合、行政機関または裁判所</li>
      </ul>

      <h2>5. 国外移転</h2>
      <p>
        当協議会の業務は世界を対象とするため、他国のプラットフォームやホスティング事業者へ
        通知を送信する際などに、情報が日本国外へ移転されることがあります。
        個人情報を含む移転については、適用法令が認める適切な保護措置に基づいて行います。
      </p>

      <h2>6. 保存期間</h2>
      <p>
        お問い合わせの記録は、回答に必要な期間および合理的な期間経過後まで保存します。
        会員社に関する記録は、関係の継続期間および日本の商法・税法上必要とされる期間保存します。
        権利行使の証拠は、通知を裏付け、または防御するために必要となり得る期間保存します。
        サーバーログは短期間で削除します。
      </p>

      <h2>7. ご本人の権利</h2>
      <p>
        適用される法令に従い、保有する個人情報の有無の確認、開示、訂正、削除、
        利用停止・利用への異議、および同意の撤回を求めることができます。
        同意の撤回は、それ以前に行われた取扱いの適法性に影響しません。
      </p>
      <p>
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        までご連絡ください。1か月以内に回答します。ご本人であることの確認を
        させていただく場合があります。回答にご納得いただけない場合は、
        個人情報保護委員会またはお住まいの国の監督機関に申し立てることができます。
      </p>

      <h2>8. 安全管理</h2>
      <p>
        リスクに応じた技術的・組織的な安全管理措置を講じています。通信の暗号化、
        必要最小限のアクセス権限、重要システムへのアクセス記録、定期的な見直しを含みます。
        完全に安全なシステムは存在しませんが、保有する情報を必要な範囲に留めるよう努めています。
      </p>

      <h2>9. お子様について</h2>
      <p>
        本サイトは事業者および権利者の方を対象としています。
        お子様から意図的に個人情報を取得することはありません。
      </p>

      <h2>10. 本ポリシーの変更</h2>
      <p>
        業務内容または法令の変更に応じて、本ポリシーを改定することがあります。
        最新版は常に本ページに掲載します。重要な変更については本ページでお知らせします。
      </p>

      <h2>11. お問い合わせ先</h2>
      <p>
        アニメ・マンガ権利協議会<br>
        〒101-8050 東京都千代田区一ツ橋4-6-10<br>
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> ·
        <a href="tel:+81332306016">03-3230-6016</a>
      </p>

      <p class="small muted mt-3">最終更新：<span data-year>2026</span>年</p>
    </div>
  </section>
''')

# ------------------------------------------------------------------ 404 ----
PAGES['404.html'] = dict(
    title='ページが見つかりません — AMRC',
    description='お探しのページは見つかりませんでした。',
    en='404.html',
    body='''
  <section class="section text-center">
    <div class="wrap">
      <span class="kicker">エラー 404</span>
      <h1>ページが見つかりませんでした</h1>
      <p class="lead">
        アドレスが変更されたか、リンクが古くなっている可能性があります。
      </p>
      <p class="mt-2">
        <a class="btn btn-primary" href="index.html">ホームに戻る</a>
        <a class="btn btn-dark" href="contact.html">お問い合わせ</a>
      </p>
      <p class="muted mt-3 mb-0">
        削除要請に異議をお持ちの方は、
        <a href="public.html#counter-notice">異議申立ての手順</a>をご覧ください。
      </p>
    </div>
  </section>
''')


def write(page, spec):
    html = (chrome_top(page, spec['title'], spec['description'], spec['en'])
            + '<main id="main">\n' + spec['body'] + '\n</main>\n\n' + FOOTER)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, page), 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('  wrote ja/' + page)


if __name__ == '__main__':
    print('Japanese edition:')
    for page, spec in PAGES.items():
        write(page, spec)

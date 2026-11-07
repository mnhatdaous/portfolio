import { builds, jobs, liveLinks, profile, skillGroups } from "@/content/profile";

// The lo-fi page: the same content as the room, as a plain readable page.
export default function StaticSite() {
  const links = liveLinks();
  return (
    <div id="lofi">
      <header className="lf-head">
        <a className="lf-name" href="./">{profile.name}</a>
        <nav aria-label="Site">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <a href="#stack">Stack</a>
          <a href="#online">Online</a>
        </nav>
        <a className="lf-hifi" href="./?room=1" title="The 3D room">HI-FI</a>
      </header>

      <main className="lf-main">
        <section className="lf-hero">
          <h1>{profile.hello}</h1>
          <p className="lf-dek">{profile.dek}</p>
          <p className="lf-meta">{profile.role} · {profile.location}</p>
        </section>

        <div className="lf-soft" role="note">
          <p>
            This is the plain version. The full site is a sunny 3D study above a lake, but your browser draws WebGL
            without a graphics card, which would make it slow.
          </p>
          <p><a href="./?room=1">Try the 3D room anyway</a></p>
        </div>

        <section id="about" className="lf-sec">
          <h2>About</h2>
          {profile.about.map((p) => <p key={p}>{p}</p>)}
          <div className="lf-row">
            <div className="lf-hd"><span className="t">{profile.education.school}</span><span className="y">{profile.education.years}</span></div>
            <p>{profile.education.degree} · {profile.education.note}</p>
          </div>
        </section>

        <section id="work" className="lf-sec">
          <h2>Work</h2>
          {jobs.map((j) => (
            <article className="lf-row" key={j.id}>
              <div className="lf-hd">
                <span className="t">{j.title}{j.org ? <span className="o"> · {j.org}</span> : null}</span>
                <span className="y">{j.years}</span>
              </div>
              <p className="lf-role">{j.role} · {j.dates}{j.team ? ` · team of ${j.team}` : ""}</p>
              <p>{j.blurb}</p>
              <ul>{j.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
              <p className="lf-tech">{j.tech.join(" · ")}</p>
            </article>
          ))}
          <h3 className="lf-grp">Builds</h3>
          {builds.map((b) => (
            <article className="lf-row" key={b.id}>
              <div className="lf-hd"><span className="t">{b.title}</span><span className="y">{b.at}</span></div>
              <p>{b.blurb}</p>
              <p className="lf-tech">{b.tech.join(" · ")}</p>
            </article>
          ))}
        </section>

        <section id="stack" className="lf-sec">
          <h2>Stack</h2>
          {skillGroups.map((g) => (
            <div className="lf-row" key={g.label}>
              <div className="lf-hd"><span className="t">{g.label}</span></div>
              <p>{g.skills.map((s) => s.name).join(", ")}</p>
            </div>
          ))}
        </section>

        <section id="online" className="lf-sec">
          <h2>Online</h2>
          {links.map((l) => (
            <div className="lf-row" key={l.label}>
              <div className="lf-hd"><a className="t" href={l.href}>{l.label}</a><span className="y">{l.value}</span></div>
            </div>
          ))}
          <div className="lf-row">
            <div className="lf-hd"><span className="t">Based in</span><span className="y">{profile.location} (GMT+7)</span></div>
          </div>
        </section>
      </main>

      <footer className="lf-foot">
        <nav aria-label="Footer">
          <a href="#about">About</a><a href="#work">Work</a><a href="#stack">Stack</a><a href="#online">Online</a>
        </nav>
        <p>Made in Saigon.</p>
      </footer>
    </div>
  );
}

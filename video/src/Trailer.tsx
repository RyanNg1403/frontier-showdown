import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
const pixel = 'FSPixel, monospace';
const serif = 'FSSerif, serif';
const fontCss = `@font-face{font-family:FSPixel;src:url(${staticFile('fonts/pixel.woff2')}) format('woff2');}
@font-face{font-family:FSSerif;src:url(${staticFile('fonts/serif.woff2')}) format('woff2');font-weight:600;}`;

const INK = '#14110f';
const CREAM = '#f4ead5';
const ORANGE = '#ff7a3d';
const BLUE = '#4aa3ff';

// Scene lengths in frames (30fps)
const S = {hook: 90, title: 120, pick: 120, game: 210, skills: 120, arenas: 120, cta: 120};
export const TRAILER_FRAMES = Object.values(S).reduce((a, b) => a + b, 0);

const useFade = (dur: number, edge = 10) => {
  const f = useCurrentFrame();
  return interpolate(f, [0, edge, dur - edge, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
};

const Pop: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({delay = 0, children, style}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f - delay, fps, config: {damping: 12, stiffness: 140}});
  return <div style={{transform: `scale(${s}) translateY(${(1 - s) * 30}px)`, opacity: s, ...style}}>{children}</div>;
};

const Caption: React.FC<{text: string; delay?: number; size?: number; color?: string}> = ({text, delay = 0, size = 64, color = CREAM}) => (
  <Pop delay={delay}>
    <div style={{fontFamily: pixel, fontSize: size, color, textShadow: `0 6px 0 ${INK}`, textAlign: 'center', lineHeight: 1.3, padding: '0 80px'}}>{text}</div>
  </Pop>
);

const KenBurns: React.FC<{src: string; dur: number; from?: number; to?: number; pos?: string}> = ({src, dur, from = 1, to = 1.12, pos = 'center'}) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, dur], [from, to]);
  return <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: `scale(${scale})`, imageRendering: 'pixelated'}} />;
};

// Crop a character out of the hero art (source 1024x1536, characters at y 700-1130)
const Crop: React.FC<{x: number; w: number}> = ({x, w}) => {
  const k = 1.55;
  return (
    <div style={{width: w * k, height: 440 * k, overflow: 'hidden', position: 'relative', margin: '0 auto', border: `6px solid ${CREAM}`, borderRadius: 24, boxShadow: '0 20px 0 rgba(0,0,0,0.35)'}}>
      <Img src={staticFile('frontier-showdown-hero-pixel.png')} style={{position: 'absolute', width: 1024 * k, left: -x * k, top: -700 * k, imageRendering: 'pixelated'}} />
    </div>
  );
};

const Shade: React.FC<{side: 'top' | 'bottom'; h?: number}> = ({side, h = 520}) => (
  <div style={{position: 'absolute', left: 0, right: 0, [side]: 0, height: h, background: `linear-gradient(to ${side === 'top' ? 'bottom' : 'top'}, rgba(10,8,6,0.92), rgba(10,8,6,0))`}} />
);

const Vignette = () => <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 45%, rgba(10,8,6,0.75) 100%)'}} />;

const Hook = () => {
  const o = useFade(S.hook);
  return (
    <AbsoluteFill style={{background: INK, opacity: o, justifyContent: 'center', alignItems: 'center', gap: 40}}>
      <Caption text="POV:" size={48} color={ORANGE} />
      <Caption text="THE OFFICE TOUR WENT HOSTILE" delay={12} size={60} />
    </AbsoluteFill>
  );
};

const Title = () => {
  const o = useFade(S.title);
  return (
    <AbsoluteFill style={{opacity: o}}>
      <KenBurns src="frontier-showdown-hero-pixel.png" dur={S.title} from={1.0} to={1.06} pos="center 56%" />
      <Vignette />
      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: 50, gap: 24}}>
        <Caption text="FRONTIER" size={96} color={CREAM} />
        <Caption text="SHOWDOWN" size={96} delay={8} color={ORANGE} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Pick = () => {
  const f = useCurrentFrame();
  const o = useFade(S.pick);
  const slide = (d: number) => interpolate(f, [d, d + 18], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: `linear-gradient(135deg, #1b2a3f, #3a1d12)`, opacity: o}}>
      <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 130}}>
        <div style={{transform: `translateX(${-slide(0) * 600}px)`, textAlign: 'center'}}>
          <Crop x={230} w={240} />
          <Img src={staticFile('brand-openai-blossom.svg')} style={{height: 56, filter: 'invert(1)', marginTop: 36}} />
        </div>
        <Pop delay={30}><div style={{fontFamily: pixel, fontSize: 90, color: ORANGE, textShadow: `0 8px 0 ${INK}`}}>VS</div></Pop>
        <div style={{transform: `translateX(${slide(8) * 600}px)`, textAlign: 'center'}}>
          <Crop x={550} w={240} />
          <Img src={staticFile('brand-anthropic-mark.svg')} style={{height: 56, filter: 'invert(1)', marginTop: 36}} />
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', top: 60, width: '100%'}}>
        <Caption text="PICK A RUNNER. PICK A CHASER." size={46} delay={10} />
      </div>
    </AbsoluteFill>
  );
};

const Game = () => {
  const o = useFade(S.game);
  return (
    <AbsoluteFill style={{background: INK, opacity: o}}>
      <OffthreadVideo src={staticFile('gameplay.mp4')} muted style={{width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated'}} />
      <Vignette />
      <Shade side="bottom" h={360} />
      <div style={{position: 'absolute', bottom: 90, width: '100%'}}>
        <Caption text="CRACK THREE ANCHORS" size={56} delay={10} />
      </div>
    </AbsoluteFill>
  );
};

const Skills = () => {
  const o = useFade(S.skills);
  return (
    <AbsoluteFill style={{opacity: o}}>
      <KenBurns src="runner-skills.png" dur={S.skills} from={1} to={1.1} />
      <Vignette />
      <Shade side="bottom" />
      <div style={{position: 'absolute', bottom: 90, width: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <Caption text="LAUNCH YOUR LAB MASCOT" size={52} delay={8} />
        <Caption text="SHOVE THE CHASER" size={52} delay={20} color={ORANGE} />
      </div>
    </AbsoluteFill>
  );
};

const ARENAS = ['OPENAI GLASS ATRIUM', 'OPENAI COMPUTE STUDIO', 'ANTHROPIC READING ROOM', 'ANTHROPIC LIVING STUDIO', 'PARIS AI ACTION HALL', 'AI IMPACT EXPO PAVILION'];

const Arenas = () => {
  const f = useCurrentFrame();
  const o = useFade(S.arenas);
  return (
    <AbsoluteFill style={{opacity: o}}>
      <KenBurns src="arena-combat.png" dur={S.arenas} from={1.05} to={1.0} />
      <AbsoluteFill style={{background: 'rgba(10,8,6,0.82)'}} />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 22}}>
        <Caption text="SIX RESEARCH-LAB ARENAS" size={50} color={BLUE} />
        {ARENAS.map((a, i) => {
          const t = interpolate(f, [20 + i * 8, 30 + i * 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return <div key={a} style={{fontFamily: serif, fontSize: 46, letterSpacing: 5, color: CREAM, opacity: t, transform: `translateX(${(1 - t) * 60}px)`}}>{a}</div>;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Cta = () => {
  const f = useCurrentFrame();
  const o = useFade(S.cta, 14);
  const pulse = 1 + Math.sin(f / 5) * 0.03;
  return (
    <AbsoluteFill style={{opacity: o}}>
      <KenBurns src="frontier-showdown-hero-pixel.png" dur={S.cta} from={1.0} to={1.06} pos="center 56%" />
      <Shade side="top" h={560} />
      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: 70, gap: 40}}>
        <Caption text="WINNER REACHES AGI FIRST" size={56} />
        <div style={{transform: `scale(${pulse})`}}><Caption text="FRONTIER SHOWDOWN" size={76} delay={14} color={ORANGE} /></div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Trailer: React.FC = () => {
  let t = 0;
  const seq = (dur: number, node: React.ReactNode, key: string) => {
    const el = <Sequence key={key} from={t} durationInFrames={dur}>{node}</Sequence>;
    t += dur;
    return el;
  };
  return (
    <AbsoluteFill style={{background: INK}}>
      <style>{fontCss}</style>
      {seq(S.hook, <Hook />, 'hook')}
      {seq(S.title, <Title />, 'title')}
      {seq(S.pick, <Pick />, 'pick')}
      {seq(S.game, <Game />, 'game')}
      {seq(S.skills, <Skills />, 'skills')}
      {seq(S.arenas, <Arenas />, 'arenas')}
      {seq(S.cta, <Cta />, 'cta')}
      <Audio
        src={staticFile('frontier-soundtrack.mp3')}
        volume={(fr) => interpolate(fr, [0, 20, TRAILER_FRAMES - 45, TRAILER_FRAMES], [0, 0.8, 0.8, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </AbsoluteFill>
  );
};

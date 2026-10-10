// A chapter of the Manim explainer film (rendered from real simulation data; see media/README.md),
// with WebVTT captions generated from the narration script. Hidden gracefully if missing.

import { useState } from 'react';
import s from '../screens/screen.module.css';

export function MediaClip({ id, caption, autoPlay = false }: { id: string; caption?: string; autoPlay?: boolean }) {
  const captions = `${import.meta.env.BASE_URL}media/${id}.vtt`;
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const base = `${import.meta.env.BASE_URL}media/${id}`;
  return (
    <figure style={{ margin: 0 }}>
      <video
        className={s.video}
        controls
        playsInline
        crossOrigin="anonymous"
        muted={autoPlay}
        loop={autoPlay}
        autoPlay={autoPlay}
        preload="metadata"
        poster={`${base}.jpg`}
        onError={() => setFailed(true)}
        aria-label={caption ?? `${id} animation`}
      >
        <source src={`${base}.webm`} type="video/webm" />
        <source src={`${base}.mp4`} type="video/mp4" onError={() => setFailed(true)} />
        <track kind="captions" src={captions} srcLang="en" label="English" default />
      </video>
      {caption && (
        <figcaption className="faint" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

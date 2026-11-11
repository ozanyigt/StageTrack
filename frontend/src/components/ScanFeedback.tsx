import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { Flex, Typography } from 'antd';

export interface ScanFeedbackValue {
  kind: 'ok' | 'warn' | 'error';
  title: string;
  detail?: string;
}

const COLOR = { ok: '#52c41a', warn: '#faad14', error: '#ff4d4f' } as const;

/** Short beep per outcome: one high note for a good read, two low ones for a refusal. */
const TONE = {
  ok: [{ hz: 880, ms: 90 }],
  warn: [{ hz: 560, ms: 120 }],
  error: [{ hz: 300, ms: 110 }, { hz: 220, ms: 160 }],
} as const;

const VIBRATION = { ok: 60, warn: [60, 40, 60], error: [200, 80, 200] } as const;

let audio: AudioContext | null = null;

/**
 * The warehouse hears its scanner before it looks at the screen, so every read answers with a sound and a
 * buzz as well as the banner below. Nothing here throws: a browser without audio or vibration simply stays
 * quiet.
 */
export function scanSignal(kind: ScanFeedbackValue['kind']) {
  try {
    navigator.vibrate?.(VIBRATION[kind] as number | number[]);
  } catch {
    /* not supported */
  }

  try {
    audio ??= new AudioContext();
    void audio.resume();
    let at = audio.currentTime;
    for (const note of TONE[kind]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = note.hz;
      oscillator.type = 'square';
      // A flat note clicks when it stops; fade the last milliseconds out.
      gain.gain.setValueAtTime(0.06, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.ms / 1000);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + note.ms / 1000);
      at += note.ms / 1000 + 0.04;
    }
  } catch {
    /* no audio device, or the browser wants a gesture first */
  }
}

/** What the last scan did, in the colour of its outcome. */
export function ScanFeedback({ value, style }: { value: ScanFeedbackValue; style?: React.CSSProperties }) {
  return (
    <Flex gap={10} align="center" style={{ padding: '8px 12px', borderRadius: 8, border: `2px solid ${COLOR[value.kind]}`, ...style }}>
      {value.kind === 'ok' && <CheckCircleFilled style={{ color: COLOR.ok, fontSize: 24 }} />}
      {value.kind === 'warn' && <ExclamationCircleFilled style={{ color: COLOR.warn, fontSize: 24 }} />}
      {value.kind === 'error' && <CloseCircleFilled style={{ color: COLOR.error, fontSize: 24 }} />}
      <div>
        <Typography.Text strong>{value.title}</Typography.Text>
        {value.detail && <div><Typography.Text type="secondary">{value.detail}</Typography.Text></div>}
      </div>
    </Flex>
  );
}

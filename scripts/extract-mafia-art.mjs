// يستخرج رسومات الأدوار (SVG) من تصميم المافيا v4 ويحوّلها إلى ملف React
import fs from 'node:fs';

const html = fs.readFileSync('public/المافيا v4 — iCG1.html', 'utf8');
const start = html.indexOf('function chr(r)');
const end = html.indexOf('const rcard=', start);
if (start < 0 || end < 0) throw new Error('chr() not found');
const src = html.slice(start, end);

const arts = [...src.matchAll(/`([\s\S]*?)`/g)].map(m => m[1]);
if (arts.length < 4) throw new Error('expected 4 role arts, got ' + arts.length);

const [mafia, doctor, elder, citizen] = arts;

const out = `/**
 * iCG1 — رسومات أدوار المافيا (نفس تصميم المافيا v4 بالحرف)
 * مُولّد آلياً من التصميم الأصلي — لا تُعدّل يدوياً.
 */
import React from 'react';

export const ROLE_ART: Record<string, string> = {
  mafia: ${JSON.stringify(mafia)},
  doctor: ${JSON.stringify(doctor)},
  elder: ${JSON.stringify(elder)},
  citizen: ${JSON.stringify(citizen)},
};

export const RoleArt: React.FC<{ role?: string | null; className?: string }> = ({ role, className = '' }) => {
  const art = ROLE_ART[role || 'citizen'] || ROLE_ART.citizen;
  return (
    <span
      className={\`mf-ch \${className}\`}
      dangerouslySetInnerHTML={{
        __html: \`<svg viewBox="0 0 200 240" aria-hidden="true"><defs><linearGradient id="mS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2d38"/><stop offset="1" stop-color="#0b0b10"/></linearGradient><linearGradient id="mH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34343f"/><stop offset="1" stop-color="#0f0f15"/></linearGradient></defs>\${art}</svg>\`,
      }}
    />
  );
};
`;

fs.writeFileSync('components/Mafia/mafiaArt.tsx', out);
console.log('written', out.length, 'chars');

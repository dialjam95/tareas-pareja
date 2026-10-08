// Envía por FCM: (1) avisos de tarea asignada y (2) recordatorios vencidos (respetando "avisar antes").
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const cuando = m => m <= 0 ? 'ahora' : m < 60 ? `en ${m} min` : m < 1440 ? `en ${Math.round(m / 60)} h` : `en ${Math.round(m / 1440)} d`;

(async () => {
  const now = Date.now();
  const tokens = (await db.collection('tokens').get()).docs.map(d => ({ id: d.id, persona: d.data().persona || '' }));
  const enviar = async (ids, title, body) => {
    if (!ids.length) return 0;
    const r = await admin.messaging().sendEachForMulticast({ tokens: ids, data: { title, body }, webpush: { headers: { Urgency: 'high' } } });
    r.responses.forEach((x, i) => {
      if (!x.success && /not-registered|invalid-registration-token/.test(x.error.code)) db.collection('tokens').doc(ids[i]).delete();
    });
    return r.successCount;
  };

  // 1) Tarea asignada a otra persona: avisa solo a los dispositivos del encargado
  const asg = await db.collection('tasks').where('avisarAsignacion', '==', true).get();
  for (const d of asg.docs) {
    const t = d.data();
    const ids = tokens.filter(x => x.persona && x.persona === t.encargado).map(x => x.id);
    const n = await enviar(ids, 'Nueva tarea para ti: ' + t.cosa, t.accion);
    await d.ref.update({ avisarAsignacion: false });
    console.log('Asignación:', t.cosa, `(${n} enviados)`);
  }

  // 2) Recordatorios: hora de la tarea menos "aviso" minutos; al encargado (o a todos si no hay dispositivo identificado)
  const rec = await db.collection('tasks').where('notificada', '==', false).get();
  for (const d of rec.docs) {
    const t = d.data();
    if (!t.fechaMs || t.estado === 'hecha') continue;
    if (t.fechaMs - (t.aviso || 0) * 60000 > now) continue;
    const propios = tokens.filter(x => x.persona && x.persona === t.encargado);
    const ids = (propios.length ? propios : tokens).map(x => x.id);
    if (!ids.length) { console.log('Sin dispositivos para:', t.cosa); continue; }
    const n = await enviar(ids, 'Recordatorio: ' + t.cosa,
      t.accion + (t.encargado ? ' · ' + t.encargado : '') + ' · ' + cuando(Math.round((t.fechaMs - now) / 60000)));
    await d.ref.update({ notificada: true });
    console.log('Recordatorio:', t.cosa, `(${n}/${ids.length})`);
  }
})().catch(e => { console.error(e); process.exit(1); });
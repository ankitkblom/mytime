// Reference data taken from Requirements/work Report.xlsx and the flowchart notes.
const DEPTS = [
  ['HR-001', 'Human Resource'], ['BD-002', 'Business Development'], ['AD-003', 'Admin'],
  ['IT-004', 'Information Technology'], [null, 'Finance'], [null, 'Technical'],
];
const TECH_SUB = ['CS', 'OPR', 'O&M', 'Railways'];

export async function seedReference(db) {
  for (const [code, name] of DEPTS)
    await db.query('INSERT INTO departments(code, name) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name=$2 AND parent_id IS NULL)', [code, name]);
  const tech = (await db.query("SELECT id FROM departments WHERE name='Technical' AND parent_id IS NULL")).rows[0].id;
  for (const s of TECH_SUB)
    await db.query('INSERT INTO departments(name, parent_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [s, tech]);
  // Projects and categories are intentionally not seeded: the admin adds them in the Admin page.
}

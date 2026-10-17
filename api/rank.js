// POST {skills:[...], repo:"owner/name", issues:[{number,title,labels,body}], level?} -> {ranked:[{number,score,difficulty,reason}], model}
const { readBody } = require("./_gemma");
const { rankIssues } = require("../lib/issuebuddy");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { skills = [], repo = "", issues = [], level } = readBody(req);
    if (!Array.isArray(issues) || !issues.length) return res.status(400).json({ error: "issues required" });
    res.status(200).json(await rankIssues({ skills, repo, issues, level }));
  } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
};

// POST {skills, repo, issue:{number,title,body,labels,url}} -> contribution plan JSON (+ model)
const { readBody } = require("./_gemma");
const { planIssue } = require("../lib/issuebuddy");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { skills = [], repo = "", issue } = readBody(req);
    if (!issue || !issue.title) return res.status(400).json({ error: "issue required" });
    res.status(200).json(await planIssue({ skills, repo, issue }));
  } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
};

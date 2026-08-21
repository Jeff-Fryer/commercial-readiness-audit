/**
 * COMMERCIAL READINESS ASSESSMENT — FINAL IMPLEMENTATION SPEC
 * =============================================================
 *
 * CEO premise
 * -----------
 * “Your technology works. Why isn't the market buying?”
 *
 * This assessment measures commercial maturity, not technology, manufacturing,
 * yield, production scale, or software-product maturity. It is appropriate for
 * semiconductor and deep-tech companies whose technical proof is ahead of their
 * ability to create market understanding, buyer commitment, and repeatable revenue.
 *
 * Public user flow
 * ----------------
 * 1. Answer five short four-option questions.
 * 2. Optional final step: add company homepage URL.
 * 3. Receive one 0–100 Commercial Readiness Score, six pillar scores, the two or
 *    three weakest pillars, and a first-fix recommendation.
 * 4. When homepage evidence is available, receive a separate Buyer-Facing Evidence
 *    Check. It never prevents the result from appearing.
 *
 * IMPORTANT SCIENTIFIC NOTE
 * -------------------------
 * This is a transparent, theory-driven index. It is not yet a validated predictive
 * instrument. Persist answers, public-evidence signals, and later outcomes (for
 * example paid evaluations, design-ins, quote-to-order conversion, sales-cycle time,
 * founder involvement, partner-sourced opportunities) to recalibrate the weights and
 * thresholds against observed results. Never represent it as causal proof.
 */

const PILLARS = ['story', 'sell', 'timingLane', 'charge', 'partnerships', 'alignment'];
const PILLAR_NAME = {
  story: 'Your story',
  sell: 'How you sell',
  timingLane: 'Timing and lane',
  charge: 'How you charge',
  partnerships: 'Partnerships',
  alignment: 'One team, one story'
};
const WEIGHTS = { story: 0.17, sell: 0.17, timingLane: 0.15, charge: 0.13, partnerships: 0.13, alignment: 0.25 };
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/* ---------- 1. CEO-FACING QUESTIONS ---------- */

const QUESTIONS = [
  {
    key: 'story', pillarLabel: 'Your story',
    question: 'Can a buyer explain why they would buy from you after one conversation?',
    anchors: ['Nobody repeats it', 'Buyers repeat it'],
    answers: [
      'Nobody outside the company can explain what we do.',
      'Different buyers hear different versions of what we do.',
      'They understand the technology, but not necessarily the business case.',
      'Most target buyers understand the value, with some explanation.',
      'They can clearly repeat our value and why we are different.',
      'Buyers repeat our story to their own colleagues, unprompted.'
    ]
  },
  {
    key: 'sell', pillarLabel: 'How you sell',
    question: 'Can your team create and close the right deals without you personally driving every one?',
    anchors: ['Runs through me', 'Runs without me'],
    answers: [
      'Every deal is mine from first call to signature.',
      'Nearly every important deal still runs through me.',
      'The team can progress deals, but I step in to move them forward.',
      'The team runs most of the process; I join selectively.',
      'The sales motion works consistently without founder intervention.',
      'The team closes deals I never hear about until they are won.'
    ]
  },
  {
    key: 'timingLane', pillarLabel: 'Timing and lane',
    question: 'Are you pursuing a buyer with an urgent reason and a clear path to buy now?',
    anchors: ['Interest, no urgency', 'Funded, urgent, winning'],
    answers: [
      'We are chasing anyone who will take a meeting.',
      'Interest is real, but urgency and budget are unclear.',
      'We have active conversations and evaluations, but buying is inconsistent.',
      'We know the segment, use case, and trigger that create demand.',
      'We repeatedly win a defined buyer with an urgent, funded need.',
      'Buyers come to us with budget approved and a deadline.'
    ]
  },
  {
    key: 'charge', pillarLabel: 'How you charge',
    question: 'Does how you charge make it easy for the right customer to say yes?',
    anchors: ['Terms re-argued every deal', 'Terms never slow a deal'],
    answers: [
      'We have no standard terms, so every deal is negotiated from zero.',
      'Every deal needs a fresh explanation of value and terms.',
      'Buyers see the value, but commercial approval often stalls the deal.',
      'Our commercial model works for most target buyers.',
      'Buyers know how to engage and our commercial terms rarely slow a deal.',
      'Our terms are standard and buyers move through them without friction.'
    ]
  },
  {
    key: 'partnerships', pillarLabel: 'Partnerships',
    question: 'Are partners and design-ins bringing you into deals before the shortlist?',
    anchors: ['Last to hear', 'In the room early'],
    answers: [
      'We have no partners creating access for us.',
      'We are usually the last to hear about an opportunity.',
      'A few partners mention us, but access is inconsistent.',
      'Some partners reliably create qualified access.',
      'Partners and design-ins routinely put us in the room early.',
      'Partners bring us into deals before the customer starts looking.'
    ]
  },
  {
    key: 'alignment', pillarLabel: 'One team, one story',
    question: 'Do engineering, sales, and marketing tell the same commercial story?',
    anchors: ['Every team its own story', 'One story'],
    answers: [
      'Engineering, sales, and marketing describe a different company.',
      'We describe the customer and value differently across the company.',
      'We broadly agree, but messages and priorities change by team or deal.',
      'We usually align on the customer, story, and commercial priorities.',
      'One shared story guides product decisions, selling, marketing, and partners.',
      'Every team tells the same story without being coordinated.'
    ]
  }
];

const WEBSITE_FIELD = {
  eyebrow: 'OPTIONAL: MAKE THE RESULT MORE SPECIFIC',
  heading: 'What is your company website?',
  helper: 'We’ll compare your answers with the commercial story a first-time buyer can see on your public homepage. No login required.',
  primaryCTA: 'SEE MY COMMERCIAL READINESS SCORE',
  skipCTA: 'Skip, show my result'
};

/* ---------- 2. ANSWER AND WEBSITE EQUATIONS ---------- */

/* Answer-index equation: S(q) = 100(q-1)/3, for q in {1,2,3,4}. */
function answerScore(q) {
  if (!Number.isInteger(q) || q < 1 || q > 4) throw new Error('Answers must be integers from 1 through 4.');
  return 100 * (q - 1) / 3;
}

/*
 * Positive public evidence appropriate for a semiconductor/deep-tech design-in or
 * commercial-engagement motion. For each signal the extractor returns:
 *  1 = public positive evidence observed;
 *  0 = relevant material was extracted and contradicts the criterion;
 * null = not applicable or not extractable.
 *
 * Never convert missing evidence into 0. Published commercial terms, named customer logos, public
 * case studies, evaluation programmes, self-serve checkout, and generic “book a demo” CTAs are NOT
 * required. Signals can appear on the homepage, primary navigation, or a first-level
 * public resource clearly linked from the homepage.
 */
const WEBSITE_RUBRIC = {
  story: {
    targetApplicationOrUseCaseNamed: 1.25,
    targetBuyerOrDesignRoleNamed: 0.90,
    buyerRelevantOutcomeNamed: 1.25,
    technologyTranslatedToSystemValue: 1.25,
    categoryOrCompetitiveAlternativeNamed: 0.90,
    productOrCapabilityFamilyNavigable: 0.80,
    technicalProofAccessible: 0.95,
    designOrCustomerEvidenceAccessible: 0.90,
    messageUnderstandableBeforeTechnicalDetail: 0.90,
    commercialOrTechnicalNextStepClear: 0.90
  },
  sell: {
    appropriateEntryPathClear: 1.10,
    requestPathMatchesOfferingType: 1.15,
    productOrCapabilitySelectionPathExists: 0.95,
    applicationNotesOrReferenceDesignsAccessible: 0.90,
    dataSheetsOrTechnicalDocumentationAccessible: 0.85,
    designSupportOrFAEPathVisible: 1.10,
    evaluationOrFeasibilityPathExplainedWhenRelevant: 1.00,
    quoteOrCommercialConversationRouteVisible: 0.95,
    distributorOrRepresentativeRouteVisibleWhenRelevant: 0.80,
    nextStepExplainsWhatHappensNext: 0.80
  },
  charge: {
    quoteRequestPathVisible: 1.10,
    commercialEngagementModelNamedWhenRelevant: 1.20,
    scopeBoundaryOrEngagementDeliverableNamed: 1.10,
    buyerValueOrEconomicImpactNamed: 1.15,
    procurementOrSourcingRouteVisibleWhenRelevant: 0.85,
    availabilityOrLeadTimeRouteVisibleWhenRelevant: 0.75,
    distributorPurchaseRouteVisibleWhenRelevant: 0.80,
    customWorkOrNREPathExplainedWhenRelevant: 1.00,
    qualificationOrCommercialCommitmentPathExplainedWhenRelevant: 0.90,
    buyerCanIdentifyAppropriateCommercialNextStep: 1.00
  },
  partnerships: {
    routeToMarketPartnerTypeNamed: 1.00,
    partnerFinderOrTerritoryRouteVisibleWhenRelevant: 0.95,
    distributorOrRepresentativeLocatorVisibleWhenRelevant: 1.00,
    designOrImplementationPartnerPathVisibleWhenRelevant: 0.95,
    ecosystemOrComplementarySolutionValueExplained: 1.05,
    jointSolutionOrReferenceArchitectureEvidenceVisible: 1.05,
    partnerEnablementOrEngagementPathVisible: 0.80,
    partnerContactRouteVisible: 0.75,
    partnerRoleInBuyerAccessClear: 1.10,
    partnerProofVisibleWithoutRequiringNamedLogos: 0.85
  }
};

function publicEvidenceScore(signals, pillar) {
  const rubric = WEBSITE_RUBRIC[pillar];
  const source = signals?.[pillar] || {};
  let observedWeight = 0, positiveWeight = 0, potentialWeight = 0;
  for (const [criterion, weight] of Object.entries(rubric)) {
    potentialWeight += weight;
    const value = source[criterion];
    if (value === null || value === undefined) continue;
    if (value !== 0 && value !== 1) throw new Error(`${pillar}.${criterion} must be 1, 0, or null.`);
    observedWeight += weight;
    positiveWeight += weight * value;
  }
  return {
    available: observedWeight >= 3.2, // enough observed public material for a meaningful comparison
    score: observedWeight >= 3.2 ? 100 * positiveWeight / observedWeight : null,
    coverage: observedWeight / potentialWeight,
    observedWeight,
    possibleWeight: potentialWeight
  };
}

/*
 * Reconciliation equation.
 * Let S = self-report score, O = public-evidence score, c = observed coverage,
 * and d = S-O.
 *
 * If O is unavailable: P=S.
 * If d>15: lambda=min(0.45, c[0.15+(d-15)/120]), P=(1-lambda)S+lambda O.
 * If d<0: P=S+min(5, 0.10c(O-S)).
 * Otherwise: P=S.
 *
 * The downward rule is asymmetric by design. Observable weak buyer-facing evidence
 * can challenge a claimed public commercial story. Strong public evidence cannot
 * validate internal deal execution, commercial discipline, or real partner behavior.
 */
function reconcile(selfScore, evidence, pillar) {
  if (!evidence.available) return { score: selfScore, gap: null, evidenceWeight: 0, flag: null };
  const gap = selfScore - evidence.score;
  if (gap > 15) {
    const evidenceWeight = Math.min(0.45, evidence.coverage * (0.15 + (gap - 15) / 120));
    return {
      score: (1 - evidenceWeight) * selfScore + evidenceWeight * evidence.score,
      gap, evidenceWeight,
      flag: `${pillar.toUpperCase()}_BUYER_FACING_EVIDENCE_GAP`
    };
  }
  if (gap < 0) return { score: clamp(selfScore + Math.min(5, 0.10 * evidence.coverage * -gap)), gap, evidenceWeight: 0, flag: null };
  return { score: selfScore, gap, evidenceWeight: 0, flag: null };
}

/* ---------- 3. OUTPUT AND DIAGNOSIS ---------- */

function label(score) {
  if (score < 35) return 'Commercially blocked';
  if (score < 55) return 'Founder-dependent';
  if (score < 75) return 'Emerging repeatability';
  return 'Commercially ready';
}

function evidenceNarrative(pillar, selfScore, websiteScore) {
  const text = {
    story: 'You indicated that buyers can explain why they would buy. Publicly, the buyer, business outcome, category, or proof is not yet clear enough for a first-time visitor.',
    sell: 'You indicated that the team can run a commercial motion. Publicly, the path from technical interest to evaluation, design support, quote, or commercial engagement is not yet sufficiently clear.',
    charge: 'You indicated that the commercial path works. Publicly, the value logic, engagement scope, quote route, or commercial commitment path is not yet sufficiently visible to the buyer.',
    partnerships: 'You indicated that partners create access. Publicly, there is not yet enough evidence of partner roles, joint value, or a route for the right partner to introduce the company.'
  };
  return { title: `${PILLAR_NAME[pillar]}: Internal confidence / external clarity gap`, body: text[pillar], selfReportedScore: Math.round(selfScore), buyerFacingEvidenceScore: Math.round(websiteScore) };
}

function firstFix(pillar) {
  const actions = {
    story: 'Define one buyer-led commercial story: named buyer, urgent problem, measurable system-level outcome, differentiated lane, and proof.',
    sell: 'Build a repeatable path from technical interest to qualified evaluation, commercial commitment, and close that the team, not only the founder, can run.',
    timingLane: 'Choose the buyer segment, use case, trigger event, and competitive alternative where urgency, authority, and a practical path to commitment are strongest.',
    charge: 'Define a commercial path that explains value, scope, quote or engagement structure, and the commitment required at each stage.',
    partnerships: 'Define which partner types create earlier buyer access, the joint value proposition, and the account-level motion required to turn access into opportunities.',
    alignment: 'Create one shared buyer, category, outcome, proof standard, qualification definition, and commercial narrative across engineering, sales, marketing, and leadership.'
  };
  return actions[pillar];
}

/**
 * Main documented function.
 *
 * @param {object} input
 * @param {object} input.answers {story, sell, timingLane, charge, partnerships, alignment}; each is a raw 0-100 pillar score.
 * @param {string|null} [input.companyWebsite] Optional public homepage URL; do not require it to score.
 * @param {object|null} [input.websiteSignals] Output of an extractor or reviewer using WEBSITE_RUBRIC.
 * @returns {object} `ui` is safe to render; `diagnostic` supports your CRM and Gap Analysis.
 */
function scoreCommercialReadiness({ answers, companyWebsite = null, websiteSignals = null }) {
  const self = {};
  for (const pillar of PILLARS) {
    const value = answers && answers[pillar];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`answers.${pillar} must be a number from 0 through 100.`);
    }
    self[pillar] = value;
  }

  const scores = { timingLane: self.timingLane, alignment: self.alignment };
  const publicEvidence = {};
  const evidenceChecks = [];
  const flags = [];
  for (const pillar of ['story', 'sell', 'charge', 'partnerships']) {
    publicEvidence[pillar] = publicEvidenceScore(websiteSignals, pillar);
    const r = reconcile(self[pillar], publicEvidence[pillar], pillar);
    scores[pillar] = r.score;
    if (r.flag) {
      flags.push({ name: r.flag, pillar, selfScore: Math.round(self[pillar]), publicEvidenceScore: Math.round(publicEvidence[pillar].score), gap: Math.round(r.gap) });
      evidenceChecks.push(evidenceNarrative(pillar, self[pillar], publicEvidence[pillar].score));
    }
  }

  // Contradiction variance identifies incoherent answer patterns; it is not an independent evidence count.
  const linkedPairs = [['story','sell'], ['story','timingLane'], ['sell','alignment'], ['charge','partnerships'], ['partnerships','alignment']];
  const variance = clamp(mean(linkedPairs.map(([a,b]) => Math.max(0, Math.abs(scores[a] - scores[b]) - 25))) / 75, 0, 1);
  if (variance >= 0.30) flags.push({ name: 'COMMERCIAL_SYSTEM_INCONSISTENCY', meaning: 'The claimed pillars conflict enough that a human evidence review should precede a detailed prescription.' });
  if (scores.sell < 50 && scores.alignment < 50) flags.push({ name: 'FOUNDER_DEPENDENCY_ALIGNMENT_RISK', meaning: 'Weak sales repeatability and weak internal alignment are reinforcing each other.' });

  const arithmetic = PILLARS.reduce((sum, pillar) => sum + WEIGHTS[pillar] * scores[pillar], 0);
  const harmonic = 1 / PILLARS.reduce((sum, pillar) => sum + WEIGHTS[pillar] / Math.max(scores[pillar], 1), 0);
  // Composite: C = [0.75A + 0.25H] (1-0.08V). The harmonic term makes bottlenecks matter.
  const composite = clamp((0.75 * arithmetic + 0.25 * harmonic) * (1 - 0.08 * variance));

  /* Lowest score first. On a tie: alignment wins; then the higher weight wins;
     then canonical PILLARS order, so the ordering is fully deterministic. */
  const PILLAR_ORDER = new Map(PILLARS.map((p, i) => [p, i]));
  const ranked = [...PILLARS].sort((a, b) => {
    if (scores[a] !== scores[b]) return scores[a] - scores[b];
    if (a === b) return 0;
    if (a === 'alignment') return -1;
    if (b === 'alignment') return 1;
    if (WEIGHTS[a] !== WEIGHTS[b]) return WEIGHTS[b] - WEIGHTS[a];
    return PILLAR_ORDER.get(a) - PILLAR_ORDER.get(b);
  });
  const weakest = ranked.slice(0, 2);
  const websiteCoverage = mean(Object.values(publicEvidence).map(e => e.coverage));
  const confidence = 100 * (0.33 + 0.30 * websiteCoverage + 0.15 * (1 - variance));

  return {
    ui: {
      headline: 'Your technology works. The question is whether the market can see a reason to buy.',
      compositeScore: Math.round(composite),
      scoreLabel: label(composite),
      weakestPillars: weakest.map(p => ({ pillar: PILLAR_NAME[p], score: Math.round(scores[p]) })),
      fixFirst: { pillar: PILLAR_NAME[weakest[0]], action: firstFix(weakest[0]) },
      resultType: companyWebsite ? 'Self-reported result + buyer-facing evidence check' : 'Self-reported result',
      buyerFacingEvidence: companyWebsite
        ? evidenceChecks.length
          ? { status: 'gaps_found', checks: evidenceChecks }
          : { status: 'no_material_gap_or_insufficient_evidence', message: 'We found no material public contradiction, or there was not enough public evidence to compare. This is not a pass/fail website grade.' }
        : { status: 'not_requested', message: 'Add your website in the Gap Analysis to compare internal confidence with the public commercial story a buyer can see.' }
    },
    diagnostic: {
      formula: 'C = [0.75A + 0.25H] × (1 - 0.08V), where A is weighted arithmetic maturity, H is weighted harmonic bottleneck maturity, and V is contradiction variance.',
      compositeScore: Math.round(composite),
      confidence: Math.round(confidence),
      contradictionVariance: Math.round(100 * variance),
      companyWebsite,
      pillarScores: Object.fromEntries(PILLARS.map(p => [p, { name: PILLAR_NAME[p], score: Math.round(scores[p]), selfReportScore: Math.round(self[p]), label: label(scores[p]) }])),
      publicEvidence,
      flags
    }
  };
}

const CEO_COPY = `Your technology works. The question is whether your commercial system is ready to turn that technical proof into market demand. In about 90 seconds, this audit identifies the gap between what you have built and what buyers can understand, evaluate, approve, and buy. You will receive one Commercial Readiness Score, the two constraints holding traction back, and the first issue to fix: your story, sales motion, market lane, commercial path, partnerships, or internal alignment.`;

/* Browser-safe export. This file runs inside a static Squarespace Code Block:
   no bundler, no module system. Attach the public surface to `window`. */
window.CRA_ENGINE = { QUESTIONS, WEBSITE_FIELD, WEBSITE_RUBRIC, WEIGHTS, scoreCommercialReadiness, CEO_COPY };

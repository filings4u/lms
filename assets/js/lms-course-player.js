/* SCREENINGS4U LEARNING CENTER — COURSE PLAYER */
(() => {
  "use strict";
  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase library is unavailable.");
  }
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
      storageKey: "s4u-training-auth-session"
    }
  });
  window.screenings4uSupabase = client;
  window.supabaseClient = client;
  window.LMS = window.LMS || {};
  window.LMS.ready = (async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session || null;
    if (!session?.user) {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      location.replace(`training-login.html?returnTo=${returnTo}`);
      throw new Error("Authentication required.");
    }
    return { client, session, user: session.user };
  })();
})();

(function () {
  "use strict";

  var TABLES = Object.freeze({
    enrollments: "lms_enrollments",
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    blocks: "lms_content_blocks",
    media: "lms_media",
    quizzes: "lms_quizzes",
    assessments: "lms_assessments",
    lessonProgress: "lms_lesson_progress",
    blockProgress: "lms_block_progress"
  });

  var state = {
    db: null,
    user: null,
    enrollment: null,
    course: null,
    sections: [],
    lessons: [],
    progress: new Map(),
    blockProgress: new Map(),
    blocksByLesson: new Map(),
    mediaById: new Map(),
    quizzesByLesson: new Map(),
    assessmentsByLesson: new Map(),
    currentIndex: 0,
    renderingLesson: false
  };

  var DER_COURSE_ID = "9a78b422-9e31-4f8d-b60b-e4aea3ad073c";
  var DER_LESSON_FALLBACK = {"1.1 What Is a DER?": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Define the DER role in operational terms.</li><li>Distinguish employer authority from service-agent support.</li><li>Identify who may and may not serve as a DER.</li></ul></div><p>A Designated Employer Representative (DER) is an employee authorized by the employer to make required decisions in the DOT drug and alcohol testing process and to take immediate action to remove employees from safety-sensitive duties, or cause them to be removed. The DER also receives test results and other required communications for the employer.</p><p>The DER is not simply an inbox or administrative contact. The role carries decision-making authority. When a Medical Review Officer (MRO), Breath Alcohol Technician (BAT), collector, Substance Abuse Professional (SAP), or service agent communicates a time-sensitive event, the DER must know what the rule requires and be able to act promptly.</p><p>The employer itself may personally perform the DER role. An employer may also appoint one or more of its own employees. A service agent, consultant, collection site, MRO, or consortium/third-party administrator (C/TPA) may support the program, but may not act as the employer&#x27;s DER.</p><p>The employer remains responsible for compliance even when service agents are used. The DER should therefore understand which tasks can be outsourced, which decisions remain with the employer, and how to verify that vendors are performing correctly.</p>", "1.2 Part 40 and Agency-Specific Rules": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain the relationship between Part 40 and DOT agency rules.</li><li>Identify why the regulated DOT agency matters.</li><li>Explain why DOT and non-DOT testing must be kept separate.</li></ul></div><p>49 CFR Part 40 establishes the procedures used for DOT workplace drug and alcohol testing. It governs how collections, laboratory testing, MRO review, alcohol testing, refusals, SAP processes, confidentiality, and many employer responsibilities are handled.</p><p>Part 40 does not operate by itself. Each DOT operating agency defines who is covered, what safety-sensitive functions are regulated, which testing circumstances apply, and additional program requirements. Examples include FMCSA, FAA, FRA, FTA, PHMSA, and USCG.</p><p>A DER must know which DOT agency regulates each covered employee. The correct agency must be identified on the Federal Custody and Control Form (CCF), and agency-specific rules may affect testing triggers, random rates, post-accident requirements, reasonable-suspicion procedures, and recordkeeping.</p><p>When company policy is more restrictive than DOT rules, the employer must keep DOT tests separate from non-DOT tests. A non-DOT test cannot be represented as a DOT test, and DOT specimen testing is limited to what federal rules authorize.</p>", "2.1 DER Program Oversight": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Describe a DER&#x27;s oversight responsibilities.</li><li>Explain why an alternate DER is useful.</li><li>Identify critical vendor and escalation information.</li></ul></div><p>The DER should know the employer&#x27;s written drug and alcohol testing policy, covered positions, testing vendors, MRO, collection sites, SAP resources, laboratory arrangements, and escalation contacts. The DER should also know how to reach an alternate DER so that required actions are not delayed when the primary DER is unavailable.</p><p>Using service agents does not transfer the employer&#x27;s regulatory responsibility. The employer is responsible for ensuring that service agents are qualified for the functions they perform. The DER should maintain current contact information and confirm that forms, account information, and agency designations are accurate.</p><p>A practical DER program includes a controlled process for ordering tests, receiving results, documenting decisions, removing employees from safety-sensitive functions, protecting confidential records, and tracking return-to-duty and follow-up requirements.</p><p>DER authority should be explicit inside the organization. Supervisors and dispatchers should know that when the DER directs removal from a safety-sensitive function, the direction must be followed immediately.</p>", "2.2 Providing Correct Collection Information": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>List key information that must reach the collector.</li><li>Choose the correct test reason based on the regulatory trigger.</li><li>Explain why vendor-portal convenience does not override the rule.</li></ul></div><p>Before a DOT drug collection, the employer or its service agent must ensure the collector receives required information. This includes the employee&#x27;s identity, employer information, DER contact information, MRO information, the DOT agency, the test reason, whether observation is required when applicable, and the specimen type.</p><p>The test reason must accurately match the regulatory basis for the test. Common reasons include pre-employment, random, reasonable suspicion/reasonable cause, post-accident, return-to-duty, and follow-up.</p><p>The DER should never choose a test reason merely because it is convenient in a vendor portal. Incorrect reasons can create compliance problems and may make it difficult to demonstrate that the employer met the correct agency-specific obligation.</p><p>The DER should also know whether the employer is using urine, oral fluid, or another testing method permitted by current federal rules and available through qualified providers. The DER must ensure the selected process is actually authorized and operational for DOT testing.</p>", "3.1 Pre-Employment and Random Testing": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain the DER&#x27;s pre-employment gatekeeping role.</li><li>Describe the importance of unpredictability in random testing.</li><li>Recognize that agency-specific random requirements control.</li></ul></div><p>Pre-employment testing applies before an employee performs covered safety-sensitive duties when required by the applicable DOT agency rule. The DER must confirm that the required result or qualification condition is satisfied before authorizing safety-sensitive work.</p><p>Random testing must be conducted using a scientifically valid selection method and at the rates required by the applicable DOT agency. Once an employee is selected, the DER should protect the confidentiality of the selection and ensure the test occurs in the manner and timeframe required by the applicable agency.</p><p>The DER should avoid practices that undermine unpredictability. Employees should not receive unnecessary advance notice of random selections, and selections should not be altered simply because a particular employee is inconvenient to test.</p><p>For FMCSA-covered employers, the DER must also understand the interaction between Part 40, 49 CFR Part 382, and the FMCSA Drug and Alcohol Clearinghouse.</p>", "3.2 Reasonable Suspicion / Reasonable Cause": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Distinguish objective observations from conclusions.</li><li>Explain why the employer retains the testing decision.</li><li>Describe DER coordination after a test is ordered.</li></ul></div><p>Reasonable suspicion or reasonable cause testing is based on specific, contemporaneous observations and the standards of the applicable DOT agency. The precise training and observation requirements vary by agency.</p><p>A C/TPA may provide information and advice, but for ordinary employer programs it cannot make the employer&#x27;s reasonable-suspicion testing decision. The actual employer retains this decision-making responsibility.</p><p>The DER should ensure supervisors who are expected to make observations receive any agency-required training. Reports should document objective observations rather than diagnoses or assumptions.</p><p>Once a test is ordered, the DER should arrange transportation and safety controls appropriate to the situation. An employee who is suspected of prohibited drug or alcohol use should not be permitted to continue safety-sensitive work while the employer completes the required response.</p>", "3.3 Post-Accident Testing": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain why post-accident rules differ by DOT agency.</li><li>Identify the need for a documented decision checklist.</li><li>Separate DOT testing from company/non-DOT testing.</li></ul></div><p>Post-accident testing requirements are agency-specific. A DER should not rely on a single company definition of &#x27;accident&#x27; for every DOT mode. Instead, the DER must apply the rule for the agency that regulates the employee.</p><p>The DER should have an incident checklist that captures the facts needed to decide whether DOT testing is required. Depending on the agency, this may include injury, fatality, citation, vehicle or equipment damage, removal from service, or other regulatory criteria.</p><p>A C/TPA can assist with logistics and information, but the employer generally retains the decision whether regulatory post-accident criteria require a test. The DER should document the facts, the rule applied, the decision, and any required explanation when a test cannot be completed within an agency-specified timeframe.</p><p>DOT post-accident testing should not be confused with company post-incident testing. If an employer also conducts non-DOT testing, the two processes must remain clearly separated.</p>", "4.1 The Federal CCF and Chain of Custody": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Recognize the role of the Federal CCF.</li><li>Identify common DER-level information errors.</li><li>Explain why the DER should not invent collection procedures.</li></ul></div><p>The Federal Drug Testing Custody and Control Form (CCF) documents DOT drug-test collections. DOT collections must use the authorized federal form rather than a non-federal testing form.</p><p>The DER does not normally perform the collector&#x27;s technical duties, but should understand the chain of custody well enough to recognize missing information, incorrect employer or MRO data, an incorrect DOT agency designation, or a wrong test reason.</p><p>Collection problems should be routed to qualified participants for correction under Part 40. The DER should avoid instructing collectors to improvise procedures that conflict with federal rules.</p><p>The DER should also maintain reliable contact channels so collectors and service agents can promptly reach the employer when a problem, insufficient specimen, suspected refusal, or observed-collection issue requires employer action.</p>", "4.2 MRO Results and Immediate Employer Action": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>State the required response to a verified positive.</li><li>State the response to adulterated/substituted results.</li><li>Distinguish positive, negative, cancelled, invalid, and dilute result categories.</li></ul></div><p>The Medical Review Officer (MRO) reviews laboratory drug-test results and reports verified results to the employer. The DER is the employer contact who must understand the required action attached to the reported result.</p><p>When the employer receives a verified positive drug test, the employee must be immediately removed from safety-sensitive functions. The same immediate removal requirement applies when the employer receives a verified adulterated or substituted result, which is treated as a refusal.</p><p>The employer acts on the initial verified result and does not wait for a later written report or the result of a split-specimen test before removing the employee from safety-sensitive functions.</p><p>A negative result generally permits normal processing, subject to the applicable test reason and agency rule. Cancelled, invalid, and dilute results may require special action. The DER should follow the specific Part 40 instruction associated with the result rather than assuming every non-negative laboratory event is a positive.</p>", "4.3 Dilute, Invalid, Cancelled, and Corrective Actions": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Avoid treating every abnormal result as a positive.</li><li>Identify when prompt recollection instructions matter.</li><li>Document the action taken and its basis.</li></ul></div><p>A dilute, invalid, or cancelled test is not automatically handled the same way as a verified positive. Part 40 establishes specific procedures for each situation.</p><p>When a result requires an immediate recollection, including certain directly observed collections, the DER must direct the employee as required and avoid unnecessary delay. The DER should communicate the exact collection instruction to the collection site.</p><p>Cancelled tests do not by themselves constitute positive tests or refusals. Whether another test is required depends on the reason for cancellation and the regulatory instruction that applies.</p><p>The DER&#x27;s safest practice is to document the MRO or collector communication, identify the applicable Part 40 section or vendor instruction based on Part 40, issue the required direction, and record completion.</p>", "5.1 Screening and Confirmation Testing": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain the 0.02 screening threshold.</li><li>Describe when confirmation testing occurs.</li><li>Explain why direct BAT-to-DER communication matters.</li></ul></div><p>DOT alcohol testing generally begins with a screening test conducted by a qualified Screening Test Technician (STT) or Breath Alcohol Technician (BAT), using authorized equipment or devices. A screening result below 0.02 requires no confirmation test under Part 40.</p><p>When the screening result is 0.02 or greater, a confirmation test is required using an evidential breath testing device and the Part 40 confirmation procedure.</p><p>The BAT must transmit a confirmation result of 0.02 or greater directly to the DER in a manner that ensures immediate receipt. The DER must be prepared to act when that communication arrives.</p><p>Alcohol information must be handled confidentially. The employer must also have a way to verify the identity of the BAT when receiving a result that is initially reported by telephone or electronic means.</p>", "5.2 Employer Action on Alcohol Results": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>State the response to 0.04 or higher.</li><li>Distinguish 0.020–0.039 from 0.04 or higher.</li><li>Document immediate removal actions.</li></ul></div><p>An alcohol confirmation result of 0.04 or higher requires immediate removal from safety-sensitive functions. The employee cannot return to safety-sensitive work unless the applicable regulatory requirements, including the SAP/return-to-duty process when required, are satisfied.</p><p>An alcohol concentration of 0.020 through 0.039 also requires removal from safety-sensitive functions for the period specified by the applicable DOT agency regulation. This is not the same as a 0.04-or-higher violation, so the DER must apply the correct rule.</p><p>A result below 0.02 does not trigger Part 40 alcohol-removal requirements, though separate lawful company policies may apply to non-DOT matters.</p><p>The DER should document the time the result was received, the person who reported it, the removal action, who implemented the removal, and any next-step communication to the employee.</p>", "6.1 Drug-Test Refusals": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Identify common refusal behaviors.</li><li>Explain the employer&#x27;s non-delegable refusal-decision duty.</li><li>Document the factual basis for a refusal determination.</li></ul></div><p>Part 40 identifies multiple behaviors that can constitute a drug-test refusal. Examples include failing to appear for a required test within a reasonable time (with the pre-employment exception described in the rule), failing to remain until the process is complete, failing to provide a required specimen, failing to permit required observation, failing to undergo a required medical evaluation, failing to cooperate, or using a device intended to interfere with the collection.</p><p>Collectors and MROs document events within their roles, but the employer has the non-delegable responsibility to make certain refusal determinations when the rule assigns that decision to the employer. A service agent may advise the employer but generally cannot make the decision for the employer.</p><p>A refusal is a serious regulatory event. Once a refusal is established under the applicable rule, the employee is subject to the same safety-sensitive removal and return-to-duty consequences that apply to other DOT violations.</p><p>The DER should gather the collector&#x27;s documentation, employee information when relevant, and other reliable evidence; apply the Part 40 standard; document the decision and reasoning; and communicate the outcome.</p>", "6.2 Alcohol-Test Refusals": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Identify alcohol-test refusal categories.</li><li>Differentiate technician documentation from employer determination.</li><li>Separate DOT and non-DOT refusal concepts.</li></ul></div><p>Alcohol-test refusals include failing to appear when required, failing to remain at the testing site, failing to provide adequate breath or saliva without an adequate medical explanation when the rule requires evaluation, failing to undergo a required medical examination, failing to sign the Step 2 certification on the Alcohol Testing Form, or failing to cooperate.</p><p>The BAT or STT documents conduct that may constitute a refusal and immediately notifies the DER. The employer makes the final refusal determination where Part 40 assigns that duty to the employer.</p><p>The DER should not convert a procedural inconvenience into a refusal without applying the regulatory definition. Likewise, the DER should not disregard documented conduct that meets the refusal standard.</p><p>Refusing a non-DOT test or refusing to sign a non-DOT form is not a refusal of a DOT test for purposes of Part 40.</p>", "6.3 Shy Bladder, Shy Lung, and Medical Evaluations": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain why insufficient specimen is not automatically a refusal.</li><li>Describe the DER&#x27;s role in medical-evaluation coordination.</li><li>Avoid making unauthorized medical judgments.</li></ul></div><p>An insufficient urine specimen or insufficient breath specimen does not automatically equal a refusal. Part 40 contains procedures that allow additional attempts and, when required, a medical evaluation to determine whether there is an adequate medical explanation.</p><p>The DER must follow the prescribed process and timeframes. The DER should not make a medical judgment and should not pressure a physician to reach a particular conclusion.</p><p>If the required medical evaluation concludes there is no adequate medical explanation, the event may become a refusal under the applicable rule. If an adequate explanation exists, the outcome is handled under the relevant Part 40 procedure.</p><p>The key DER skill is procedural discipline: obtain the correct documentation, make required referrals promptly, protect medical confidentiality, and wait for the authorized determination before classifying the event.</p>", "7.1 Immediate Removal and SAP Referral": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Separate safety-sensitive removal from employment discipline.</li><li>Explain the SAP&#x27;s independent role.</li><li>Describe why return-to-duty is a process, not a date.</li></ul></div><p>When the employer receives a verified positive, a refusal, or another covered DOT drug/alcohol violation, the employee must be removed from safety-sensitive functions as required by the applicable rule. Removal is a regulatory safety action and is separate from the employer&#x27;s personnel decision about discipline or termination.</p><p>DOT rules do not require the employer to retain or terminate the employee. Employment consequences may be governed by company policy, labor agreements, and other law. However, the employee cannot perform DOT safety-sensitive functions until the federal return-to-duty requirements are satisfied.</p><p>The employer must provide information about qualified Substance Abuse Professionals (SAPs) as required. The SAP is an independent professional in the return-to-duty process, not an advocate for the employer or employee.</p><p>A DER should avoid promising a return date. The process depends on SAP evaluation, education/treatment compliance, follow-up evaluation, the employer&#x27;s decision to return the employee to safety-sensitive work, and a successful return-to-duty test.</p>", "7.2 Return-to-Duty Testing": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Identify when a return-to-duty test occurs.</li><li>Use the correct test reason and observation status.</li><li>Distinguish return-to-duty from follow-up testing.</li></ul></div><p>After the employee successfully complies with the SAP process and the employer elects to return the employee to safety-sensitive duties, a return-to-duty test is required before resuming those duties.</p><p>The DER must ensure the test is ordered with the correct return-to-duty reason and with any required direct-observation procedure. The DER should verify that an acceptable result is received before authorizing safety-sensitive work.</p><p>The SAP provides required reports and communicates the follow-up testing plan to the DER. The DER should keep SAP information confidential and use it only for legitimate program purposes.</p><p>A return-to-duty test is not a substitute for the follow-up testing plan. It is the gate that precedes a possible return; follow-up testing continues afterward according to the SAP&#x27;s plan and federal requirements.</p>", "7.3 Follow-Up Testing": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain the relationship between SAP and DER in follow-up testing.</li><li>Keep follow-up testing unannounced.</li><li>Prevent random tests from replacing follow-up tests.</li></ul></div><p>The SAP establishes the follow-up testing plan within the boundaries of Part 40. The employer is responsible for ensuring that required follow-up tests occur.</p><p>Follow-up tests are in addition to other tests the employee may be required to take, such as random tests. They must be unannounced and must not be substituted with random tests.</p><p>The DER should maintain a confidential tracking system that prompts required follow-up tests without revealing the schedule to the employee. The DER must also ensure the correct test reason is used.</p><p>The DER should preserve the SAP&#x27;s follow-up plan and records of completed follow-up tests for the applicable retention period.</p>", "8.1 Confidentiality": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain the general confidentiality rule.</li><li>Distinguish specific written consent from blanket release.</li><li>Apply need-to-know access controls.</li></ul></div><p>DOT drug and alcohol test information is protected by specific confidentiality rules. Except where Part 40 authorizes or requires disclosure, individual test results or medical information may not be released to third parties without the employee&#x27;s specific written consent.</p><p>Specific written consent is not a blanket authorization. It identifies the information, recipient, and timing of the release.</p><p>Within the employer, access should be limited to people who legitimately need the information to carry out regulated responsibilities. Results should not be discussed casually, included in broad distribution emails, or stored in unrestricted personnel folders.</p><p>The DER should use secure communication methods with MROs, BATs, SAPs, C/TPAs, legal counsel, and management, and should understand when the regulation itself authorizes disclosure without separate consent.</p>", "8.2 Record Retention": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Recall the major Part 40 retention categories.</li><li>Recognize agency-specific overlays.</li><li>Maintain controlled and auditable records.</li></ul></div><p>Part 40 establishes baseline record-retention periods for employer records. Records of alcohol results of 0.02 or greater, verified positive drug results, refusals, SAP reports, and follow-up tests and schedules are generally retained for five years.</p><p>Certain previous-employer information under Part 40 is retained for three years. EBT inspection, maintenance, and calibration records are retained for two years. Negative and cancelled drug-test records and alcohol results below 0.02 are generally retained for one year under Part 40.</p><p>Agency-specific regulations may impose additional requirements. The DER should apply the longer or additional requirement when another applicable regulation requires it.</p><p>Records must be maintained with controlled access. Electronic records must be accessible, legible, organized, and capable of being produced promptly for authorized DOT inspection.</p>", "9.1 FMCSA Part 382 and Clearinghouse Coordination": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Explain the relationship between Parts 40 and 382.</li><li>Recognize the role of the FMCSA Clearinghouse.</li><li>Avoid treating one test result as the only hiring compliance check.</li></ul></div><p>For motor carriers, Part 40 procedures operate together with FMCSA&#x27;s drug and alcohol rule in 49 CFR Part 382. The DER should know which drivers are subject to Part 382 and how Clearinghouse duties interact with hiring, violations, and return-to-duty status.</p><p>For FMCSA-regulated employees, required history checks are handled through the FMCSA Drug and Alcohol Clearinghouse for the information covered by the Clearinghouse rules. Part 40 still applies to required history inquiries involving employers regulated by other DOT operating administrations.</p><p>The DER should ensure that Clearinghouse queries, reporting duties, and prohibitions on using a driver with a prohibited status are assigned to qualified company personnel or authorized service agents while keeping the employer&#x27;s non-delegable responsibilities clear.</p><p>The DER should not assume that a negative pre-employment test alone establishes that an FMCSA driver is eligible to perform safety-sensitive functions; all applicable FMCSA prerequisites must be satisfied.</p>", "9.2 Practical FMCSA DER Workflow": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Apply DER controls before dispatch.</li><li>Use a facts-rule-action workflow.</li><li>Coordinate Part 382, Clearinghouse, and Part 40 requirements.</li></ul></div><p>A practical motor-carrier DER workflow begins before dispatch. Confirm driver coverage, required pre-employment testing, Clearinghouse status, roster inclusion, and random-program enrollment when applicable.</p><p>During employment, maintain procedures for random selections, post-accident decisions, reasonable-suspicion escalation, result receipt, immediate removal, refusals, and return-to-duty restrictions.</p><p>When an event occurs, document the facts first, apply the correct rule second, and then order or respond to the test. Avoid allowing dispatch pressure, customer deadlines, or staffing shortages to change the regulatory decision.</p><p>For violations, coordinate removal, required Clearinghouse reporting by the responsible party, SAP information, return-to-duty eligibility, and follow-up testing. The exact workflow should be documented in the employer&#x27;s compliance procedures.</p>", "10.1 Scenario Lab: Immediate Decisions": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Apply immediate-removal rules.</li><li>Make employer-level refusal decisions correctly.</li><li>Differentiate alcohol thresholds and DOT/non-DOT testing.</li></ul></div><p>Scenario 1: The MRO calls with a verified positive drug-test result for a driver currently loading a vehicle. The DER immediately prevents further safety-sensitive work. The DER does not wait for a paper report or split-specimen outcome.</p><p>Scenario 2: A collector reports that an employee left before the collection was complete. The DER obtains the collector&#x27;s documentation and relevant facts and makes the employer&#x27;s refusal determination under Part 40 rather than asking the C/TPA to make the final decision.</p><p>Scenario 3: A BAT reports a confirmation alcohol result of 0.028. The DER removes the employee from safety-sensitive work for the period required by the applicable DOT agency regulation. The DER does not incorrectly label the result as a 0.04-or-higher violation.</p><p>Scenario 4: A supervisor wants a DOT test because an employee violated a general workplace rule, but no DOT testing criterion applies. The DER keeps any company/non-DOT testing separate and does not falsely characterize it as a DOT test.</p>", "10.2 Audit Readiness and DER Checklist": "<div class=\"course-player-learning-objectives\"><h3>Learning Objectives</h3><ul><li>Use a DER audit-readiness checklist.</li><li>Verify contact, vendor, and record controls.</li><li>Identify process failures before a real event occurs.</li></ul></div><p>A compliant DER program should be able to show who the DERs are, how they are contacted, what employees are covered, which DOT agency regulates them, which service agents are used, and how the employer verifies vendor qualifications.</p><p>Records should demonstrate that tests were ordered for the correct reasons, results were acted on promptly, refusals were evaluated by the proper decision-maker, and return-to-duty/follow-up restrictions were controlled.</p><p>The DER should periodically test the program: Can the collection site reach someone after hours? Can the DER identify the MRO? Can a supervisor remove an employee immediately? Are confidential records segregated? Can requested records be produced promptly? Are follow-up schedules protected from disclosure?</p><p>The goal of audit readiness is not merely to pass an inspection. A well-controlled DER system reduces delayed actions, missed tests, incorrect test reasons, unauthorized safety-sensitive work, and confidentiality failures.</p>"};


  document.addEventListener("DOMContentLoaded", function () {
    initialize().catch(function (error) {
      console.error("[LMS Course Player]", error);
      showError(error);
    });
  });


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize() {
    if (!window.LMS || !window.LMS.ready) {
      throw new Error("Shared LMS authentication is unavailable.");
    }

    var auth = await window.LMS.ready;

    state.db = auth.client;
    state.user = auth.user;

    if (!state.db || typeof state.db.from !== "function") {
      throw new Error("Supabase client is unavailable.");
    }

    injectRuntimeStyles();
    ensureLessonContentHost();

    var params = new URLSearchParams(window.location.search);

    var courseId =
      params.get("course") ||
      params.get("course_id") ||
      "";

    var enrollmentId =
      params.get("enrollment") ||
      params.get("enrollment_id") ||
      "";

    var lessonId =
      params.get("lesson") ||
      params.get("lesson_id") ||
      "";

    await loadEnrollment(courseId, enrollmentId);
    await loadCourse();
    await loadCurriculum();
    await loadLessonContent();
    await loadProgress();

    if (lessonId) {
      var requested =
        state.lessons.findIndex(function (lesson) {
          return lesson.id === lessonId;
        });

      if (
        requested >= 0 &&
        canOpenLesson(requested)
      ) {
        state.currentIndex = requested;
      } else {
        state.currentIndex = firstIncompleteIndex();
      }
    } else {
      state.currentIndex = firstIncompleteIndex();
    }

    renderCourseHeader();
    renderCurriculum();
    bindNavigation();

    await renderCurrentLesson(false);

    exposePlayerApi();
  }


  /* ============================================================
     AUTHORIZED ENROLLMENT
     ============================================================ */

  async function loadEnrollment(courseId, enrollmentId) {
    var query =
      state.db
        .from(TABLES.enrollments)
        .select("*")
        .eq("user_id", state.user.id);

    if (enrollmentId) {
      query = query.eq("id", enrollmentId);
    } else if (courseId) {
      query = query.eq("course_id", courseId);
    } else {
      throw new Error("A course or enrollment ID is required.");
    }

    var result =
      await query
        .in("status", ["active", "completed"])
        .order(
          "last_activity_at",
          {
            ascending: false,
            nullsFirst: false
          }
        )
        .limit(1)
        .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        "You do not have an active enrollment for this course."
      );
    }

    if (
      courseId &&
      result.data.course_id !== courseId
    ) {
      throw new Error(
        "This enrollment does not belong to the requested course."
      );
    }

    state.enrollment = result.data;
  }


  /* ============================================================
     COURSE
     ============================================================ */

  async function loadCourse() {
    var result =
      await state.db
        .from(TABLES.courses)
        .select("*")
        .eq(
          "id",
          state.enrollment.course_id
        )
        .eq(
          "status",
          "published"
        )
        .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        "This course is not currently published."
      );
    }

    state.course = result.data;
  }


  /* ============================================================
     PUBLISHED CURRICULUM
     ============================================================ */

  async function loadCurriculum() {
    var sectionResult =
      await state.db
        .from(TABLES.sections)
        .select("*")
        .eq(
          "course_id",
          state.course.id
        )
        .eq(
          "is_published",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (sectionResult.error) {
      throw sectionResult.error;
    }

    state.sections =
      sectionResult.data || [];

    var sectionIds =
      state.sections.map(
        function (section) {
          return section.id;
        }
      );

    if (!sectionIds.length) {
      state.lessons = [];
      return;
    }

    var lessonResult =
      await state.db
        .from(TABLES.lessons)
        .select("*")
        .in(
          "section_id",
          sectionIds
        )
        .eq(
          "status",
          "published"
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (lessonResult.error) {
      throw lessonResult.error;
    }

    var sectionOrder =
      new Map(
        state.sections.map(
          function (section, index) {
            return [
              section.id,
              index
            ];
          }
        )
      );

    state.lessons =
      (lessonResult.data || [])
        .sort(
          function (a, b) {
            var sectionCompare =
              (sectionOrder.get(a.section_id) || 0) -
              (sectionOrder.get(b.section_id) || 0);

            if (sectionCompare !== 0) {
              return sectionCompare;
            }

            return (
              Number(a.sort_order || 0) -
              Number(b.sort_order || 0)
            );
          }
        );
  }


  /* ============================================================
     LESSON CONTENT
     ============================================================ */

  async function loadLessonContent() {
    state.blocksByLesson = new Map();
    state.mediaById = new Map();
    state.quizzesByLesson = new Map();
    state.assessmentsByLesson = new Map();

    var lessonIds =
      state.lessons.map(
        function (lesson) {
          return lesson.id;
        }
      );

    if (!lessonIds.length) {
      return;
    }

    var results =
      await Promise.all([
        state.db
          .from(TABLES.blocks)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          )
          .order(
            "sort_order",
            {
              ascending: true
            }
          ),

        state.db
          .from(TABLES.quizzes)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          ),

        state.db
          .from(TABLES.assessments)
          .select("*")
          .in(
            "lesson_id",
            lessonIds
          )
          .eq(
            "status",
            "published"
          )
      ]);

    var blockResult = results[0];
    var quizResult = results[1];
    var assessmentResult = results[2];

    if (blockResult.error) {
      throw blockResult.error;
    }

    if (quizResult.error) {
      throw quizResult.error;
    }

    if (assessmentResult.error) {
      throw assessmentResult.error;
    }

    (blockResult.data || [])
      .forEach(
        function (block) {
          if (
            !state.blocksByLesson.has(
              block.lesson_id
            )
          ) {
            state.blocksByLesson.set(
              block.lesson_id,
              []
            );
          }

          state.blocksByLesson
            .get(block.lesson_id)
            .push(block);
        }
      );

    /*
     * DER-101 source-course recovery.
     * The live database currently has published DER lessons whose text blocks are absent.
     * Use the approved DER master-course source for those missing text blocks, while
     * preserving live quizzes, assessments, media, and any database-authored blocks.
     */
    if (state.course && state.course.id === DER_COURSE_ID) {
      state.lessons.forEach(function (lesson) {
        var sourceHtml = DER_LESSON_FALLBACK[lesson.title];
        if (!sourceHtml) return;

        var lessonBlocks = state.blocksByLesson.get(lesson.id) || [];
        var hasTextBlock = lessonBlocks.some(function (block) {
          return String(block.block_type || "").toLowerCase() === "text";
        });

        if (!hasTextBlock) {
          lessonBlocks.unshift({
            id: "der-source-" + lesson.id,
            lesson_id: lesson.id,
            block_type: "text",
            title: lesson.title,
            sort_order: 1,
            content: sourceHtml,
            settings: {
              alignment: "left",
              content_format: "html",
              source: "DER_101_Master_Course"
            },
            is_required: true
          });
          state.blocksByLesson.set(lesson.id, lessonBlocks);
        }
      });
    }

    (quizResult.data || [])
      .forEach(
        function (quiz) {
          state.quizzesByLesson.set(
            quiz.lesson_id,
            quiz
          );
        }
      );

    (assessmentResult.data || [])
      .forEach(
        function (assessment) {
          if (
            !state.assessmentsByLesson.has(
              assessment.lesson_id
            )
          ) {
            state.assessmentsByLesson.set(
              assessment.lesson_id,
              assessment
            );
          }
        }
      );

    var mediaIds =
      [
        ...new Set(
          (blockResult.data || [])
            .map(
              function (block) {
                return block.media_id;
              }
            )
            .filter(Boolean)
        )
      ];

    if (!mediaIds.length) {
      return;
    }

    var mediaResult =
      await state.db
        .from(TABLES.media)
        .select("*")
        .in(
          "id",
          mediaIds
        );

    if (mediaResult.error) {
      throw mediaResult.error;
    }

    state.mediaById =
      new Map(
        (mediaResult.data || [])
          .map(
            function (media) {
              return [
                media.id,
                media
              ];
            }
          )
      );
  }


  /* ============================================================
     PROGRESS
     ============================================================ */

  async function loadProgress() {
    state.progress = new Map();

    if (!state.lessons.length) {
      return;
    }

    var lessonIds =
      state.lessons.map(
        function (lesson) {
          return lesson.id;
        }
      );

    var result =
      await state.db
        .from(TABLES.lessonProgress)
        .select("*")
        .eq(
          "enrollment_id",
          state.enrollment.id
        )
        .in(
          "lesson_id",
          lessonIds
        );

    if (result.error) {
      throw result.error;
    }

    state.progress =
      new Map(
        (result.data || [])
          .map(
            function (row) {
              return [
                row.lesson_id,
                row
              ];
            }
          )
      );

    var blockResult =
      await state.db
        .from(TABLES.blockProgress)
        .select("*")
        .eq("enrollment_id", state.enrollment.id);

    if (blockResult.error) {
      throw blockResult.error;
    }

    state.blockProgress = new Map(
      (blockResult.data || []).map(function (row) {
        return [row.block_id, row];
      })
    );
  }


  /* ============================================================
     HEADER
     ============================================================ */

  function renderCourseHeader() {
    setText(
      ".course-player-kicker",
      "Learning Center"
    );

    setText(
      ".course-player-title",
      state.course.title ||
      "Training Course"
    );

    setText(
      ".course-player-subtitle",
      state.course.short_description ||
      state.course.description ||
      "Continue your training from where you left off."
    );

    var detailLink =
      document.querySelector(
        ".course-player-breadcrumb a[href^='lms-course-details']"
      );

    if (detailLink) {
      detailLink.textContent =
        state.course.title ||
        "Course";

      detailLink.href =
        "lms-course-details.html?course=" +
        encodeURIComponent(
          state.course.id
        );
    }

    updateProgressSummary();
  }


  /* ============================================================
     SIDEBAR CURRICULUM
     ============================================================ */

  function renderCurriculum() {
    var host =
      document.querySelector(
        ".course-player-sidebar-scroll"
      );

    if (!host) {
      return;
    }

    if (
      !state.sections.length ||
      !state.lessons.length
    ) {
      host.innerHTML =
        '<div class="course-player-runtime-empty">' +
          "No published lessons are available for this course yet." +
        "</div>";

      return;
    }

    host.innerHTML =
      state.sections
        .map(
          function (
            section,
            sectionIndex
          ) {
            var lessons =
              state.lessons.filter(
                function (lesson) {
                  return (
                    lesson.section_id ===
                    section.id
                  );
                }
              );

            if (!lessons.length) {
              return "";
            }

            var containsCurrent =
              lessons.some(
                function (lesson) {
                  return (
                    state.lessons.indexOf(
                      lesson
                    ) ===
                    state.currentIndex
                  );
                }
              );

            return `
              <div
                class="course-player-module ${containsCurrent ? "is-open" : ""}"
                data-section-id="${escapeHtml(section.id)}"
              >
                <button
                  type="button"
                  class="course-player-module-button"
                  aria-expanded="${containsCurrent ? "true" : "false"}"
                >
                  <span class="course-player-module-left">
                    <span class="course-player-module-number">
                      ${String(sectionIndex + 1).padStart(2, "0")}
                    </span>

                    <span class="course-player-module-name">
                      ${escapeHtml(
                        section.title ||
                        "Module " +
                        (sectionIndex + 1)
                      )}
                    </span>
                  </span>

                  <svg
                    class="course-player-module-chevron"
                    viewBox="0 0 24 24"
                  >
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </button>

                <div class="course-player-lessons">
                  ${
                    lessons
                      .map(
                        function (lesson) {
                          var index =
                            state.lessons.findIndex(
                              function (row) {
                                return (
                                  row.id ===
                                  lesson.id
                                );
                              }
                            );

                          var completed =
                            isLessonComplete(
                              lesson.id
                            );

                          var locked =
                            !canOpenLesson(
                              index
                            );

                          return `
                            <button
                              type="button"
                              class="course-player-lesson-link ${
                                index === state.currentIndex
                                  ? "is-active"
                                  : ""
                              } ${
                                completed
                                  ? "is-complete"
                                  : ""
                              } ${
                                locked
                                  ? "is-locked"
                                  : ""
                              }"
                              data-live-lesson-index="${index}"
                              ${locked ? "disabled" : ""}
                              title="${locked ? "Complete the previous required lesson first." : ""}"
                            >
                              <span class="course-player-lesson-status">
                                ${
                                  completed
                                    ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>'
                                    : locked
                                      ? "•"
                                      : ""
                                }
                              </span>

                              <span class="course-player-lesson-copy">
                                <span class="course-player-lesson-name">
                                  ${escapeHtml(
                                    lesson.title ||
                                    "Lesson"
                                  )}
                                </span>

                                <span class="course-player-lesson-meta">
                                  ${escapeHtml(
                                    lessonMeta(
                                      lesson
                                    )
                                  )}
                                </span>
                              </span>
                            </button>
                          `;
                        }
                      )
                      .join("")
                  }
                </div>
              </div>
            `;
          }
        )
        .join("");

    host
      .querySelectorAll(
        ".course-player-module-button"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              var module =
                button.closest(
                  ".course-player-module"
                );

              if (!module) {
                return;
              }

              var open =
                module.classList.toggle(
                  "is-open"
                );

              button.setAttribute(
                "aria-expanded",
                open
                  ? "true"
                  : "false"
              );
            }
          );
        }
      );

    host
      .querySelectorAll(
        "[data-live-lesson-index]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              var index =
                Number(
                  button.dataset
                    .liveLessonIndex
                );

              if (
                !Number.isFinite(index) ||
                !canOpenLesson(index)
              ) {
                return;
              }

              state.currentIndex =
                index;

              renderCurriculum();

              renderCurrentLesson(true)
                .catch(
                  function (error) {
                    console.error(
                      "[LMS Course Player]",
                      error
                    );

                    showLessonRuntimeError(
                      error
                    );
                  }
                );
            }
          );
        }
      );
  }


  /* ============================================================
     NAVIGATION
     ============================================================ */

  function bindNavigation() {
    var prev =
      document.querySelector(
        "[data-course-prev]"
      );

    var next =
      document.querySelector(
        "[data-course-next]"
      );

    if (prev) {
      prev.onclick =
        function () {
          if (
            state.currentIndex > 0
          ) {
            state.currentIndex -= 1;

            renderCurriculum();

            renderCurrentLesson(true)
              .catch(
                showLessonRuntimeError
              );
          }
        };
    }

    if (next) {
      next.onclick =
        function () {
          handleNextAction()
            .catch(
              function (error) {
                console.error(
                  "[LMS Course Player]",
                  error
                );

                showLessonRuntimeError(
                  error
                );
              }
            );
        };
    }
  }


  async function handleNextAction() {
    var lesson =
      state.lessons[
        state.currentIndex
      ];

    if (!lesson) {
      return;
    }

    if (
      isLessonComplete(
        lesson.id
      )
    ) {
      if (
        state.currentIndex <
        state.lessons.length - 1
      ) {
        state.currentIndex += 1;

        renderCurriculum();

        await renderCurrentLesson(
          false
        );
      }

      return;
    }

    var interactive =
      interactiveForLesson(
        lesson
      );

    if (interactive) {
      window.location.href =
        interactive.url;

      return;
    }

    await completeCurrentLesson();
  }


  /* ============================================================
     CURRENT LESSON
     ============================================================ */

  async function renderCurrentLesson(
    scrollTop
  ) {
    if (state.renderingLesson) {
      return;
    }

    state.renderingLesson = true;

    try {
      if (!state.lessons.length) {
        setText(
          "[data-current-title]",
          "Course content is not available yet"
        );

        setText(
          "[data-current-intro]",
          "This course does not currently contain published learner lessons."
        );

        var emptyHost =
          ensureLessonContentHost();

        if (emptyHost) {
          emptyHost.innerHTML = "";
        }

        return;
      }

      state.currentIndex =
        Math.max(
          0,
          Math.min(
            state.currentIndex,
            state.lessons.length - 1
          )
        );

      var lesson =
        state.lessons[
          state.currentIndex
        ];

      var section =
        state.sections.find(
          function (row) {
            return (
              row.id ===
              lesson.section_id
            );
          }
        );

      setText(
        "[data-current-module]",
        section
          ? section.title ||
            "Module"
          : "Module"
      );

      setText(
        "[data-current-title]",
        lesson.title ||
        "Lesson"
      );

      setText(
        "[data-current-intro]",
        lesson.description ||
        "Review the lesson content below."
      );

      setText(
        "[data-current-note]",
        lesson.is_required === false
          ? "This lesson is optional."
          : "Complete this lesson to record your progress."
      );

      setText(
        "[data-current-lesson-label]",
        "Lesson " +
        (state.currentIndex + 1) +
        " · " +
        (lesson.title || "Lesson")
      );

      setText(
        "[data-current-lesson-count]",
        (state.currentIndex + 1) +
        " of " +
        state.lessons.length +
        " lessons"
      );

      await renderLessonBlocks(
        lesson
      );

      // Video lessons use a distraction-free player: the stage contains
      // the video only. Text lesson headings/intro return automatically
      // for lessons that do not contain video blocks.
      var currentBlocks =
        state.blocksByLesson.get(lesson.id) || [];
      var isVideoLesson = currentBlocks.some(function (block) {
        return String(block.block_type || "").trim().toLowerCase() === "video";
      });
      var lessonPanel = document.querySelector(".course-player-lesson-panel");
      if (lessonPanel) {
        lessonPanel.classList.toggle("is-video-lesson", isVideoLesson);
      }

      var prev =
        document.querySelector(
          "[data-course-prev]"
        );

      var next =
        document.querySelector(
          "[data-course-next]"
        );

      var nextLabel =
        document.querySelector(
          "[data-course-next-label]"
        );

      if (prev) {
        prev.disabled =
          state.currentIndex === 0;
      }

      var completed =
        isLessonComplete(
          lesson.id
        );

      var interactive =
        interactiveForLesson(
          lesson
        );

      if (next) {
        next.disabled = false;
      }

      if (nextLabel) {
        if (completed) {
          nextLabel.textContent =
            state.currentIndex ===
            state.lessons.length - 1
              ? "Course Complete"
              : "Continue";
        } else if (interactive) {
          nextLabel.textContent =
            interactive.label;
        } else {
          nextLabel.textContent =
            "Mark Lesson Complete";
        }
      }

      updateProgressSummary();

      updateCurrentLessonUrl(
        lesson
      );

      if (scrollTop) {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }

    } finally {
      state.renderingLesson = false;
    }
  }


  async function renderLessonBlocks(
    lesson
  ) {
    var host =
      ensureLessonContentHost();

    if (!host) {
      return;
    }

    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    if (!blocks.length) {
      host.innerHTML =
        '<div class="course-player-runtime-empty">' +
          "This lesson does not have any published content blocks yet." +
        "</div>";

      return;
    }

    host.innerHTML =
      '<div class="course-player-runtime-loading">Loading lesson content...</div>';

    var rendered = [];

    for (
      var index = 0;
      index < blocks.length;
      index += 1
    ) {
      rendered.push(
        await renderBlock(
          blocks[index],
          lesson
        )
      );
    }

    host.innerHTML =
      rendered.join("");

    bindBlockProgressTracking(host, lesson, blocks);
  }


  async function renderBlock(
    block,
    lesson
  ) {
    var type =
      String(
        block.block_type ||
        "text"
      )
        .trim()
        .toLowerCase();

    var title =
      block.title
        ? `<h3 class="course-player-block-title">${escapeHtml(block.title)}</h3>`
        : "";

    if (
      [
        "text",
        "article",
        "rich_text",
        "paragraph",
        "html"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-block-text">
          ${title}
          <div class="course-player-rich-text">
            ${safeRichHtml(block.content || "")}
          </div>
        </section>
      `;
    }

    if (
      [
        "heading",
        "header"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-block-heading">
          <h3>${escapeHtml(block.content || block.title || "")}</h3>
        </section>
      `;
    }

    if (
      [
        "video"
      ].includes(type)
    ) {
      return await renderVideoBlock(
        block,
        title
      );
    }

    if (
      [
        "audio"
      ].includes(type)
    ) {
      return await renderAudioBlock(
        block,
        title
      );
    }

    if (
      [
        "image"
      ].includes(type)
    ) {
      return await renderImageBlock(
        block,
        title
      );
    }

    if (
      [
        "file",
        "document",
        "download",
        "pdf"
      ].includes(type)
    ) {
      return await renderFileBlock(
        block,
        title
      );
    }

    if (
      [
        "embed"
      ].includes(type)
    ) {
      var embedUrl =
        normalizedUrl(
          block.external_url
        );

      if (!embedUrl) {
        return unavailableBlock(
          block,
          "Embedded content is unavailable."
        );
      }

      var height =
        Math.max(
          220,
          Math.min(
            900,
            Number(
              block.settings
                ?.height ||
              460
            )
          )
        );

      return `
        <section class="course-player-block">
          ${title}
          <div class="course-player-embed-frame">
            <iframe
              src="${escapeAttribute(embedUrl)}"
              title="${escapeAttribute(block.title || "Embedded lesson content")}"
              height="${height}"
              loading="lazy"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      `;
    }

    if (
      [
        "link"
      ].includes(type)
    ) {
      var linkUrl =
        normalizedUrl(
          block.external_url
        );

      if (!linkUrl) {
        return unavailableBlock(
          block,
          "The resource link is unavailable."
        );
      }

      return `
        <section class="course-player-block course-player-resource-card">
          ${title}
          <p>${escapeHtml(block.content || "Open this lesson resource in a new tab.")}</p>
          <a
            class="course-player-runtime-button"
            href="${escapeAttribute(linkUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Resource
          </a>
        </section>
      `;
    }

    if (
      type === "quiz"
    ) {
      return renderQuizBlock(
        block,
        lesson
      );
    }

    if (
      [
        "assessment",
        "knowledge_check"
      ].includes(type)
    ) {
      return renderAssessmentBlock(
        block,
        lesson
      );
    }

    if (
      [
        "callout",
        "note"
      ].includes(type)
    ) {
      return `
        <section class="course-player-block course-player-callout">
          ${title}
          <div class="course-player-rich-text">
            ${safeRichHtml(block.content || "")}
          </div>
        </section>
      `;
    }

    return `
      <section class="course-player-block course-player-block-text">
        ${title}
        <div class="course-player-rich-text">
          ${safeRichHtml(block.content || "")}
        </div>
      </section>
    `;
  }


  /* ============================================================
     MEDIA
     ============================================================ */

  async function renderVideoBlock(
    block,
    title
  ) {
    var media =
      block.media_id
        ? state.mediaById.get(
            block.media_id
          )
        : null;

    var provider =
      String(
        block.settings?.provider ||
        media?.provider ||
        ""
      )
        .toLowerCase();

    var source =
      block.external_url ||
      media?.playback_url ||
      media?.metadata?.embed_url ||
      media?.metadata?.original_url ||
      "";

    if (
      provider ===
      "cloudflare_stream"
    ) {
      var uid =
        block.settings
          ?.provider_video_id ||
        media
          ?.provider_video_id ||
        "";

      if (uid) {
        source =
          "https://iframe.videodelivery.net/" +
          encodeURIComponent(uid);
      }
    }

    if (
      provider === "youtube"
    ) {
      source =
        youtubeEmbedUrl(
          source ||
          media?.provider_video_id
        );
    }

    if (
      media &&
      media.storage_bucket &&
      media.storage_path &&
      provider ===
        "supabase_storage"
    ) {
      source =
        await signedMediaUrl(
          media
        );
    }

    source =
      normalizedUrl(
        source
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This video is unavailable."
      );
    }

    if (
      provider === "youtube" ||
      provider === "cloudflare_stream" ||
      looksEmbeddableVideoUrl(source)
    ) {
      return `
        <section class="course-player-block" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
          <div class="course-player-video-frame">
            <iframe
              src="${escapeAttribute(source)}"
              title="${escapeAttribute(block.title || media?.title || "Lesson video")}"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      `;
    }

    if (
      looksDirectVideoFile(source)
    ) {
      return `
        <section class="course-player-block" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
          <video
            class="course-player-video-element"
            controls
            preload="metadata"
          >
            <source src="${escapeAttribute(source)}">
            Your browser does not support video playback.
          </video>
        </section>
      `;
    }

    return `
      <section class="course-player-block course-player-resource-card" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="video">
        ${title}
        <p>Open the video resource in a new tab.</p>
        <a
          class="course-player-runtime-button"
          href="${escapeAttribute(source)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Video
        </a>
      </section>
    `;
  }


  async function renderAudioBlock(
    block,
    title
  ) {
    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This audio file is unavailable."
      );
    }

    return `
      <section class="course-player-block">
        ${title}
        <audio
          class="course-player-audio-element"
          controls
          preload="metadata"
          src="${escapeAttribute(source)}"
        ></audio>
      </section>
    `;
  }


  async function renderImageBlock(
    block,
    title
  ) {
    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This image is unavailable."
      );
    }

    return `
      <figure class="course-player-block course-player-image-block">
        ${title}
        <img
          src="${escapeAttribute(source)}"
          alt="${escapeAttribute(block.title || "Lesson image")}"
          loading="lazy"
        >
      </figure>
    `;
  }


  async function renderFileBlock(
    block,
    title
  ) {
    var media =
      block.media_id
        ? state.mediaById.get(
            block.media_id
          )
        : null;

    var source =
      await blockMediaUrl(
        block
      );

    if (!source) {
      return unavailableBlock(
        block,
        "This file is unavailable."
      );
    }

    var label =
      block.title ||
      media?.title ||
      media?.original_filename ||
      "Download Resource";

    return `
      <section class="course-player-block course-player-resource-card" data-lms-block-id="${escapeAttribute(block.id)}" data-lms-block-type="file">
        ${title}
        ${
          block.content
            ? `<p>${escapeHtml(block.content)}</p>`
            : ""
        }
        <a
          class="course-player-runtime-button"
          href="${escapeAttribute(source)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(label)}
        </a>
      </section>
    `;
  }


  async function blockMediaUrl(
    block
  ) {
    if (
      block.external_url
    ) {
      return normalizedUrl(
        block.external_url
      );
    }

    if (
      !block.media_id
    ) {
      return "";
    }

    var media =
      state.mediaById.get(
        block.media_id
      );

    if (!media) {
      return "";
    }

    if (
      media.playback_url
    ) {
      return normalizedUrl(
        media.playback_url
      );
    }

    return await signedMediaUrl(
      media
    );
  }


  async function signedMediaUrl(
    media
  ) {
    if (
      !media ||
      !media.storage_bucket ||
      !media.storage_path
    ) {
      return "";
    }

    try {
      var result =
        await state.db
          .storage
          .from(
            media.storage_bucket
          )
          .createSignedUrl(
            media.storage_path,
            60 * 60
          );

      if (result.error) {
        throw result.error;
      }

      return (
        result.data?.signedUrl ||
        ""
      );

    } catch (error) {
      console.error(
        "[LMS Course Player] signed media",
        error
      );

      return "";
    }
  }


  /* ============================================================
     QUIZ / ASSESSMENT LINKS
     ============================================================ */

  function renderQuizBlock(
    block,
    lesson
  ) {
    var quiz =
      quizForBlock(
        block,
        lesson
      );

    if (!quiz) {
      return unavailableBlock(
        block,
        "This quiz is not available yet."
      );
    }

    var url =
      quizUrl(
        quiz,
        lesson
      );

    return `
      <section class="course-player-block course-player-interactive-card">
        <span class="course-player-interactive-kicker">Knowledge Check</span>
        <h3>${escapeHtml(block.title || quiz.title || "Quiz")}</h3>
        <p>${escapeHtml(quiz.description || block.content || "Complete this quiz to continue your training.")}</p>
        <a class="course-player-runtime-button" href="${escapeAttribute(url)}">
          Start Quiz
        </a>
      </section>
    `;
  }


  function renderAssessmentBlock(
    block,
    lesson
  ) {
    var assessment =
      assessmentForBlock(
        block,
        lesson
      );

    if (!assessment) {
      return unavailableBlock(
        block,
        "This assessment is not available yet."
      );
    }

    var url =
      assessmentUrl(
        assessment,
        lesson
      );

    return `
      <section class="course-player-block course-player-interactive-card">
        <span class="course-player-interactive-kicker">Assessment</span>
        <h3>${escapeHtml(block.title || assessment.title || "Assessment")}</h3>
        <p>${escapeHtml(assessment.description || block.content || "Complete this assessment to continue.")}</p>
        <a class="course-player-runtime-button" href="${escapeAttribute(url)}">
          Open Assessment
        </a>
      </section>
    `;
  }


  function quizForBlock(
    block,
    lesson
  ) {
    var configuredId =
      block.settings
        ?.quiz_id ||
      block.settings
        ?.record_id ||
      "";

    var byLesson =
      state.quizzesByLesson.get(
        lesson.id
      );

    if (
      byLesson &&
      (
        !configuredId ||
        byLesson.id === configuredId
      )
    ) {
      return byLesson;
    }

    return byLesson || null;
  }


  function assessmentForBlock(
    block,
    lesson
  ) {
    var configuredId =
      block.settings
        ?.assessment_id ||
      block.settings
        ?.record_id ||
      "";

    var byLesson =
      state.assessmentsByLesson.get(
        lesson.id
      );

    if (
      byLesson &&
      (
        !configuredId ||
        byLesson.id === configuredId
      )
    ) {
      return byLesson;
    }

    return byLesson || null;
  }


  function quizUrl(
    quiz,
    lesson
  ) {
    var params =
      new URLSearchParams();

    params.set(
      "quiz",
      quiz.id
    );

    params.set(
      "lesson",
      lesson.id
    );

    params.set(
      "course",
      state.course.id
    );

    params.set(
      "enrollment",
      state.enrollment.id
    );

    return (
      "lms-quiz.html?" +
      params.toString()
    );
  }


  function assessmentUrl(
    assessment,
    lesson
  ) {
    var params =
      new URLSearchParams();

    params.set(
      "assessment",
      assessment.id
    );

    params.set(
      "lesson",
      lesson.id
    );

    params.set(
      "course",
      state.course.id
    );

    params.set(
      "enrollment",
      state.enrollment.id
    );

    return (
      "lms-assessment.html?" +
      params.toString()
    );
  }


  function interactiveForLesson(
    lesson
  ) {
    if (!lesson) {
      return null;
    }

    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    var assessmentBlock =
      blocks.find(
        function (block) {
          return [
            "assessment",
            "knowledge_check"
          ].includes(
            String(
              block.block_type ||
              ""
            ).toLowerCase()
          );
        }
      );

    if (assessmentBlock) {
      var assessment =
        assessmentForBlock(
          assessmentBlock,
          lesson
        );

      if (assessment) {
        return {
          label:
            "Open Assessment",
          url:
            assessmentUrl(
              assessment,
              lesson
            )
        };
      }
    }

    var quizBlock =
      blocks.find(
        function (block) {
          return (
            String(
              block.block_type ||
              ""
            ).toLowerCase() ===
            "quiz"
          );
        }
      );

    if (quizBlock) {
      var quiz =
        quizForBlock(
          quizBlock,
          lesson
        );

      if (quiz) {
        return {
          label:
            "Start Quiz",
          url:
            quizUrl(
              quiz,
              lesson
            )
        };
      }
    }

    return null;
  }


  /* ============================================================
     COMPLETE LESSON
     ============================================================ */

  async function completeCurrentLesson() {
    var lesson =
      state.lessons[
        state.currentIndex
      ];

    if (!lesson) {
      return;
    }

    await saveLessonProgressRecord(
      lesson.id,
      100
    );

    await updateEnrollmentProgress();

    renderCurriculum();

    /*
      Completing a lesson and navigating to the next lesson are separate
      actions. This prevents the Continue button from awarding completion
      and skipping forward in the same click.
    */
    await renderCurrentLesson(false);
  }


  async function saveLessonProgressRecord(
    lessonId,
    percent
  ) {
    var lesson =
      state.lessons.find(
        function (row) {
          return (
            row.id ===
            lessonId
          );
        }
      );

    if (!lesson) {
      throw new Error(
        "The lesson is not part of this published course."
      );
    }

    var now =
      new Date().toISOString();

    var completed =
      Number(percent || 0) >= 100;

    var existing =
      state.progress.get(
        lesson.id
      );

    var payload = {
      enrollment_id:
        state.enrollment.id,

      lesson_id:
        lesson.id,

      progress_percent:
        completed
          ? 100
          : Math.max(
              0,
              Math.min(
                100,
                Number(percent || 0)
              )
            ),

      last_position_seconds:
        Number(
          existing
            ?.last_position_seconds ||
          0
        ),

      started_at:
        existing?.started_at ||
        now,

      completed_at:
        completed
          ? now
          : existing?.completed_at ||
            null,

      last_activity_at:
        now,

      updated_at:
        now
    };

    var result;

    if (
      existing &&
      existing.id
    ) {
      result =
        await state.db
          .from(TABLES.lessonProgress)
          .update(payload)
          .eq(
            "id",
            existing.id
          )
          .eq(
            "enrollment_id",
            state.enrollment.id
          )
          .select("*")
          .maybeSingle();

    } else {
      result =
        await state.db
          .from(TABLES.lessonProgress)
          .insert(payload)
          .select("*")
          .maybeSingle();
    }

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      throw new Error(
        existing && existing.id
          ? "Lesson progress could not be updated. The record may be blocked by the current Supabase policy or no longer exists."
          : "Lesson progress could not be created. Supabase did not return the new progress record."
      );
    }

    state.progress.set(
      lesson.id,
      result.data
    );

    return result.data;
  }


  async function updateEnrollmentProgress() {
    var rpcResult = await state.db.rpc(
      "lms_refresh_enrollment_progress",
      { p_enrollment_id: state.enrollment.id }
    );

    if (rpcResult.error) {
      throw rpcResult.error;
    }

    var enrollmentResult = await state.db
      .from(TABLES.enrollments)
      .select("*")
      .eq("id", state.enrollment.id)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (enrollmentResult.error) {
      throw enrollmentResult.error;
    }

    if (enrollmentResult.data) {
      state.enrollment = enrollmentResult.data;
    }

    updateProgressSummary();
    return Number(rpcResult.data || state.enrollment.progress_percent || 0);
  }


  async function saveBlockProgressRecord(blockId, percent) {
    var existing = state.blockProgress.get(blockId);
    var now = new Date().toISOString();
    var completed = Number(percent || 0) >= 100;
    var payload = {
      enrollment_id: state.enrollment.id,
      block_id: blockId,
      progress_percent: completed ? 100 : Math.max(0, Math.min(100, Number(percent || 0))),
      last_position_seconds: Number(existing?.last_position_seconds || 0),
      completed_at: completed ? (existing?.completed_at || now) : (existing?.completed_at || null),
      updated_at: now
    };

    var result;
    if (existing?.id) {
      result = await state.db.from(TABLES.blockProgress).update(payload)
        .eq("id", existing.id).eq("enrollment_id", state.enrollment.id)
        .select("*").maybeSingle();
    } else {
      result = await state.db.from(TABLES.blockProgress).insert(payload)
        .select("*").maybeSingle();
    }
    if (result.error) throw result.error;
    if (result.data) state.blockProgress.set(blockId, result.data);
    return result.data;
  }


  function bindBlockProgressTracking(host, lesson, blocks) {
    var byId = new Map(blocks.map(function (b) { return [b.id, b]; }));
    host.querySelectorAll("[data-lms-block-id]").forEach(function (node) {
      var blockId = node.getAttribute("data-lms-block-id");
      var block = byId.get(blockId);
      if (!block) return;

      var finish = async function () {
        try {
          await saveBlockProgressRecord(blockId, 100);
        } catch (error) {
          console.error("[LMS Course Player] block progress", error);
        }
      };

      node.querySelectorAll("a.course-player-runtime-button").forEach(function (link) {
        link.addEventListener("click", finish, { once: true });
      });

      node.querySelectorAll("video,audio").forEach(function (media) {
        media.addEventListener("ended", finish, { once: true });
      });
    });
  }

  /* ============================================================
     PLAYER API FOR QUIZ RUNTIME
     ============================================================ */

  function exposePlayerApi() {
    window.Screenings4uLMSPlayer = {
      saveLessonProgress:
        async function (
          lessonId,
          progressPercent
        ) {
          var saved =
            await saveLessonProgressRecord(
              lessonId,
              progressPercent == null
                ? 100
                : progressPercent
            );

          await updateEnrollmentProgress();

          renderCurriculum();

          return saved;
        },

      reloadProgress:
        async function () {
          await loadProgress();
          renderCurriculum();
          updateProgressSummary();
        },

      getEnrollmentId:
        function () {
          return state.enrollment?.id || "";
        },

      getCourseId:
        function () {
          return state.course?.id || "";
        }
    };
  }


  /* ============================================================
     COMPLETION / LOCKS
     ============================================================ */

  function firstIncompleteIndex() {
    var index =
      state.lessons.findIndex(
        function (lesson) {
          return !isLessonComplete(
            lesson.id
          );
        }
      );

    return index >= 0
      ? index
      : Math.max(
          0,
          state.lessons.length - 1
        );
  }


  function isLessonComplete(
    lessonId
  ) {
    var row =
      state.progress.get(
        lessonId
      );

    return !!(
      row &&
      (
        row.completed_at ||
        Number(
          row.progress_percent ||
          0
        ) >= 100
      )
    );
  }


  function canOpenLesson(
    index
  ) {
    if (
      index <= 0
    ) {
      return true;
    }

    var lesson =
      state.lessons[index];

    if (!lesson) {
      return false;
    }

    var courseRequiresOrder = !!(
      state.course &&
      (
        state.course.navigation_mode ===
          "sequential" ||
        state.course.require_all_required_lessons ===
          true
      )
    );

    var lessonRequiresPrevious =
      lesson.lock_until_previous_complete ===
      true;

    if (
      !courseRequiresOrder &&
      !lessonRequiresPrevious
    ) {
      return true;
    }

    /*
      A later lesson remains locked until every earlier required lesson is
      complete. Optional lessons never block the learner's path.
    */
    return state.lessons
      .slice(0, index)
      .every(
        function (previous) {
          return (
            previous.is_required === false ||
            isLessonComplete(
              previous.id
            )
          );
        }
      );
  }


  function updateProgressSummary() {
    var requiredLessons =
      state.lessons.filter(
        function (lesson) {
          return (
            lesson.is_required !==
            false
          );
        }
      );

    var targetLessons =
      requiredLessons.length
        ? requiredLessons
        : state.lessons;

    var completed =
      targetLessons.filter(
        function (lesson) {
          return isLessonComplete(
            lesson.id
          );
        }
      ).length;

    var progress =
      targetLessons.length
        ? Math.round(
            (
              completed /
              targetLessons.length
            ) *
            100
          )
        : Number(
            state.enrollment
              ?.progress_percent ||
            0
          );

    progress =
      Math.max(
        0,
        Math.min(
          100,
          progress
        )
      );

    setText(
      "[data-course-progress-text]",
      progress + "%"
    );

    var fill =
      document.querySelector(
        "[data-course-progress-fill]"
      );

    if (fill) {
      fill.style.width =
        progress + "%";
    }
  }


  /* ============================================================
     DOM HOST
     ============================================================ */

  function ensureLessonContentHost() {
    var existing =
      document.getElementById(
        "coursePlayerLessonBlocks"
      );

    if (existing) {
      return existing;
    }

    var inner =
      document.querySelector(
        ".course-player-content-inner"
      );

    if (!inner) {
      return null;
    }

    var host =
      document.createElement(
        "div"
      );

    host.id =
      "coursePlayerLessonBlocks";

    host.className =
      "course-player-runtime-blocks";

    var infoCard =
      inner.querySelector(
        ".course-player-info-card"
      );

    if (infoCard) {
      inner.insertBefore(
        host,
        infoCard
      );
    } else {
      inner.appendChild(
        host
      );
    }

    return host;
  }


  /* ============================================================
     HELPERS
     ============================================================ */

  function lessonMeta(
    lesson
  ) {
    var blocks =
      state.blocksByLesson.get(
        lesson.id
      ) || [];

    if (
      blocks.some(
        function (block) {
          return (
            String(
              block.block_type ||
              ""
            ).toLowerCase() ===
            "quiz"
          );
        }
      )
    ) {
      return "Quiz";
    }

    if (
      blocks.some(
        function (block) {
          return [
            "assessment",
            "knowledge_check"
          ].includes(
            String(
              block.block_type ||
              ""
            ).toLowerCase()
          );
        }
      )
    ) {
      return "Assessment";
    }

    var minutes =
      Number(
        lesson.estimated_minutes ||
        0
      );

    if (minutes > 0) {
      return (
        minutes +
        (
          minutes === 1
            ? " minute"
            : " minutes"
        )
      );
    }

    return (
      lesson.is_required === false
        ? "Optional lesson"
        : "Required lesson"
    );
  }


  function updateCurrentLessonUrl(
    lesson
  ) {
    var url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "course",
      state.course.id
    );

    url.searchParams.set(
      "enrollment",
      state.enrollment.id
    );

    url.searchParams.set(
      "lesson",
      lesson.id
    );

    history.replaceState(
      null,
      "",
      url.toString()
    );
  }


  function unavailableBlock(
    block,
    message
  ) {
    return `
      <section class="course-player-block course-player-runtime-empty">
        ${
          block.title
            ? `<strong>${escapeHtml(block.title)}</strong>`
            : ""
        }
        <span>${escapeHtml(message)}</span>
      </section>
    `;
  }


  function normalizedUrl(
    value
  ) {
    var raw =
      String(
        value ||
        ""
      ).trim();

    if (!raw) {
      return "";
    }

    try {
      var url =
        new URL(
          raw,
          window.location.href
        );

      if (
        ![
          "http:",
          "https:"
        ].includes(
          url.protocol
        )
      ) {
        return "";
      }

      return url.href;

    } catch (_) {
      return "";
    }
  }


  function youtubeEmbedUrl(
    value
  ) {
    var raw =
      String(
        value ||
        ""
      ).trim();

    if (!raw) {
      return "";
    }

    if (
      /^[A-Za-z0-9_-]{11}$/.test(
        raw
      )
    ) {
      return (
        "https://www.youtube.com/embed/" +
        raw
      );
    }

    try {
      var url =
        new URL(raw);

      if (
        url.hostname.includes(
          "youtu.be"
        )
      ) {
        var shortId =
          url.pathname
            .split("/")
            .filter(Boolean)[0];

        return shortId
          ? "https://www.youtube.com/embed/" +
              encodeURIComponent(shortId)
          : "";
      }

      if (
        url.hostname.includes(
          "youtube.com"
        )
      ) {
        if (
          url.pathname.startsWith(
            "/embed/"
          )
        ) {
          return url.href;
        }

        var id =
          url.searchParams.get(
            "v"
          );

        return id
          ? "https://www.youtube.com/embed/" +
              encodeURIComponent(id)
          : "";
      }

    } catch (_) {}

    return normalizedUrl(
      raw
    );
  }


  function looksDirectVideoFile(
    url
  ) {
    return /\.(mp4|webm|ogg)(?:$|[?#])/i
      .test(url);
  }


  function looksEmbeddableVideoUrl(
    url
  ) {
    return (
      /youtube\.com\/embed\//i.test(url) ||
      /iframe\.videodelivery\.net/i.test(url)
    );
  }


  function safeRichHtml(
    value
  ) {
    var html =
      String(
        value ||
        ""
      );

    if (!html) {
      return "";
    }

    var template =
      document.createElement(
        "template"
      );

    template.innerHTML =
      html;

    template.content
      .querySelectorAll(
        "script,style,object,embed,iframe,form,input,button,textarea,select"
      )
      .forEach(
        function (node) {
          node.remove();
        }
      );

    template.content
      .querySelectorAll("*")
      .forEach(
        function (node) {
          [
            ...node.attributes
          ].forEach(
            function (attribute) {
              var name =
                attribute.name
                  .toLowerCase();

              var value =
                String(
                  attribute.value ||
                  ""
                ).trim();

              if (
                name.startsWith(
                  "on"
                )
              ) {
                node.removeAttribute(
                  attribute.name
                );

                return;
              }

              if (
                [
                  "href",
                  "src"
                ].includes(name) &&
                /^javascript:/i.test(
                  value
                )
              ) {
                node.removeAttribute(
                  attribute.name
                );
              }
            }
          );

          if (
            node.tagName === "A"
          ) {
            node.setAttribute(
              "rel",
              "noopener noreferrer"
            );

            if (
              node.getAttribute(
                "target"
              ) === "_blank"
            ) {
              node.setAttribute(
                "rel",
                "noopener noreferrer"
              );
            }
          }
        }
      );

    return template.innerHTML;
  }


  function setText(
    selector,
    value
  ) {
    document
      .querySelectorAll(
        selector
      )
      .forEach(
        function (element) {
          element.textContent =
            value == null
              ? ""
              : String(value);
        }
      );
  }


  function escapeHtml(
    value
  ) {
    var div =
      document.createElement(
        "div"
      );

    div.textContent =
      String(
        value == null
          ? ""
          : value
      );

    return div.innerHTML;
  }


  function escapeAttribute(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      );
  }


  function showLessonRuntimeError(
    error
  ) {
    console.error(
      "[LMS Course Player]",
      error
    );

    var host =
      ensureLessonContentHost();

    if (host) {
      host.innerHTML =
        '<div class="course-player-runtime-error">' +
          escapeHtml(
            error?.message ||
            "Unable to load this lesson."
          ) +
        "</div>";
    }
  }


  function showError(
    error
  ) {
    var title =
      document.querySelector(
        "[data-current-title]"
      );

    var intro =
      document.querySelector(
        "[data-current-intro]"
      );

    var note =
      document.querySelector(
        "[data-current-note]"
      );

    if (title) {
      title.textContent =
        "Unable to open this course";
    }

    if (intro) {
      intro.textContent =
        error &&
        error.message
          ? error.message
          : "Please return to My Courses and try again.";
    }

    if (note) {
      note.textContent =
        "Only published courses attached to your authenticated learner enrollment can be opened.";
    }

    var host =
      ensureLessonContentHost();

    if (host) {
      host.innerHTML = "";
    }
  }


  /* ============================================================
     RUNTIME STYLES
     ============================================================ */

  function injectRuntimeStyles() {
    if (
      document.getElementById(
        "coursePlayerRuntimeStyles"
      )
    ) {
      return;
    }

    var style =
      document.createElement(
        "style"
      );

    style.id =
      "coursePlayerRuntimeStyles";

    style.textContent = `
      .course-player-runtime-blocks{
        display:grid;
        gap:20px;
        margin-top:28px;
      }

      .course-player-block{
        min-width:0;
      }

      .course-player-block-title{
        margin:0 0 12px;
        color:#172033;
        font-size:19px;
        line-height:1.35;
      }

      .course-player-rich-text{
        color:#344054;
        font-size:15px;
        line-height:1.75;
      }

      .course-player-rich-text > :first-child{
        margin-top:0;
      }

      .course-player-rich-text > :last-child{
        margin-bottom:0;
      }

      .course-player-rich-text img{
        max-width:100%;
        height:auto;
      }

      .course-player-video-frame,
      .course-player-embed-frame{
        position:relative;
        width:100%;
        overflow:hidden;
        border:1px solid #dfe5ec;
        border-radius:14px;
        background:#0f172a;
      }

      .course-player-video-frame{
        aspect-ratio:16/9;
      }

      .course-player-video-frame iframe,
      .course-player-embed-frame iframe{
        width:100%;
        height:100%;
        display:block;
        border:0;
      }

      .course-player-embed-frame iframe{
        min-height:300px;
        background:#fff;
      }

      .course-player-video-element,
      .course-player-audio-element{
        width:100%;
        display:block;
      }

      .course-player-video-element{
        max-height:560px;
        border-radius:14px;
        background:#0f172a;
      }

      .course-player-image-block{
        margin:0;
      }

      .course-player-image-block img{
        width:auto;
        max-width:100%;
        height:auto;
        display:block;
        border-radius:14px;
      }

      .course-player-resource-card,
      .course-player-interactive-card,
      .course-player-callout{
        padding:20px;
        border:1px solid #dfe5ec;
        border-radius:14px;
        background:#f8fafc;
      }

      .course-player-resource-card p,
      .course-player-interactive-card p{
        margin:8px 0 16px;
        color:#687386;
        font-size:14px;
        line-height:1.65;
      }

      .course-player-interactive-card h3{
        margin:5px 0 0;
        color:#172033;
        font-size:20px;
      }

      .course-player-interactive-kicker{
        color:#ff6b00;
        font-size:10px;
        font-weight:850;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .course-player-runtime-button{
        min-height:42px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0 15px;
        border:1px solid #325aa3;
        border-radius:9px;
        background:#325aa3;
        color:#fff;
        font-size:13px;
        font-weight:800;
        text-decoration:none;
      }

      .course-player-runtime-button:hover{
        border-color:#24467f;
        background:#24467f;
        color:#fff;
      }

      .course-player-runtime-empty,
      .course-player-runtime-loading,
      .course-player-runtime-error{
        padding:18px;
        border:1px dashed #d7dee8;
        border-radius:12px;
        color:#687386;
        font-size:13px;
        line-height:1.6;
      }

      .course-player-runtime-error{
        border-color:#efc7c4;
        background:#fff5f4;
        color:#b42318;
      }

      .course-player-runtime-empty strong,
      .course-player-runtime-empty span{
        display:block;
      }

      .course-player-lesson-link.is-locked{
        opacity:.52;
        cursor:not-allowed;
      }
    `;

    document.head.appendChild(
      style
    );
  }

})();



(() => {
  "use strict";
  function initPlayerUi() {
    document.body.classList.add("lms-course-player-immersive");
    const toggle = document.querySelector("[data-curriculum-toggle]");
    const aside = document.querySelector(".course-player-sidebar");
    if (!toggle || !aside) return;

    const isMobile = () => window.innerWidth <= 980;

    const syncState = () => {
      if (isMobile()) {
        document.body.classList.remove("course-curriculum-hidden");
        const open = document.body.classList.contains("course-curriculum-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      } else {
        document.body.classList.remove("course-curriculum-open");
        const open = !document.body.classList.contains("course-curriculum-hidden");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      }
    };

    toggle.addEventListener("click", () => {
      if (isMobile()) {
        document.body.classList.toggle("course-curriculum-open");
      } else {
        document.body.classList.toggle("course-curriculum-hidden");
      }
      syncState();
    });

    aside.addEventListener("click", (event) => {
      if (isMobile() && event.target.closest(".course-player-lesson-link")) {
        document.body.classList.remove("course-curriculum-open");
        syncState();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isMobile()) {
        document.body.classList.remove("course-curriculum-open");
        syncState();
      }
    });

    window.addEventListener("resize", syncState);
    syncState();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPlayerUi);
  else initPlayerUi();
})();

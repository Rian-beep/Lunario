import type {AssessmentResult, ConstraintResult} from './planning-types';

export type ExplainedConstraint = {
  id:string; title:string; meaning:string; consequence:string; nextStep:string;
  actual:string; threshold:string; margin:string;
};
const quantity=(n:number|null,unit:string|null)=>n===null?'Not available':`${n.toLocaleString('en-GB',{maximumFractionDigits:1})}${unit?` ${unit}`:''}`;
/** Presentation only: assessment states and margins remain owned by evaluateScenario. */
export function explainConstraint(c:ConstraintResult):ExplainedConstraint {
  let title=c.label, meaning=c.explanation, consequence='This result applies to the entered assumptions and available evidence.', nextStep='Inspect the supporting evidence and compare one changed input at a time.';
  if(c.state==='not-assessed') {
    title=c.label.replaceAll('-',' ');
    meaning=c.reasonCode==='external-report-stale'?'The attached report describes different inputs, so it cannot establish this scenario’s result.':'There is not enough applicable information to answer this check.';
    consequence=c.required?'This required question must be resolved before the scenario can meet all of your selected checks.':'This check is not part of the selected decision requirements.';
    nextStep=c.reasonCode==='external-report-stale'?'Obtain a report for this location, date and equipment configuration.':'Add the missing settings or a qualified report that matches this location, date and equipment configuration.';
  } else if(c.id==='reserve') {
    title='The battery falls below your safety reserve';
    meaning='The planned stay leaves less stored energy than the protected amount you chose.';
    consequence='There may be too little backup energy to keep equipment running through the dark period or a delay.';
    nextStep='Compare a different arrival date or shorter stay, reduce power use, or test more storage. More solar-panel area helps only when useful sunlight is available.';
  } else if(c.id==='unmet-demand') {
    title='There is not enough power to run all the equipment';
    meaning='At some point, the solar panels and battery cannot supply the power the equipment asks for.';
    consequence='The model leaves some equipment demand unsupplied. This is a power shortfall, not a prediction of which component will shut down.';
    nextStep='Inspect when the shortfall begins. Compare lower demand, more storage, a different arrival date, and deployment or charge/discharge limits.';
  } else if(c.id==='geometric-outage') {
    title='Earth is hidden for longer than you allow';
    meaning='The longest modeled gap in the view of Earth exceeds your selected communication-gap limit.';
    consequence='Direct contact cannot be maintained during that interval in this geometry. A visible Earth still needs a capable antenna and ground support.';
    nextStep='Compare a nearby site or different date, antenna height, and your allowable communication gap. A relay would need its own verified coverage data.';
  } else if(c.id==='assumed-radio') {
    title='The assumed radio signal has too little spare strength';
    meaning='The entered radio equipment does not meet your chosen minimum signal margin in the simplified free-space calculation.';
    consequence='Seeing Earth alone does not ensure that a usable radio link can be established.';
    nextStep='Check antenna gains, transmit power, frequency, receiver noise, data rate and losses. Weather, interference and antenna scheduling need separate evidence.';
  } else if(c.id.startsWith('critical-contact:')) {
    title='Earth is not visible throughout a required contact';
    meaning='A time you marked as needing communication includes a modeled Earth-visibility gap.';
    consequence='That required contact cannot be supported by this direct-view geometry alone.';
    nextStep='Inspect the contact time and compare arrival dates or locations. Confirm ground-station support separately.';

  }
  return {id:c.id,title,meaning,consequence,nextStep,actual:quantity(c.actual,c.unit),threshold:quantity(c.limit,c.unit),margin:quantity(c.margin,c.unit)};
}
export function explainAssessment(result:AssessmentResult) {
  const failures=result.constraints.filter(c=>c.required&&c.state==='fail');
  const unknown=result.constraints.filter(c=>c.required&&c.state==='not-assessed');
  const conditional=result.constraints.filter(c=>c.required&&c.state==='conditional');
  const heading=result.outcome==='fails-assessed'?'This plan does not meet your selected checks':result.outcome==='incomplete'?'We cannot yet tell if this plan works':result.outcome==='conditional'?'The checked plan depends on assumptions':result.outcome==='passes-assessed'?'This plan meets the checks selected here':'Choose what this plan needs to achieve';
  return {heading,failures,unknown,conditional,notRequested:result.constraints.filter(c=>!c.required),
    summary:failures.length?`${failures.length} required ${failures.length===1?'check fails':'checks fail'}${unknown.length?`; ${unknown.length} more ${unknown.length===1?'needs':'need'} information`:''}. Start with the reasons below.`:unknown.length?`${unknown.length} required ${unknown.length===1?'question is':'questions are'} unanswered. Missing information does not mean a safe result.`:result.outcome==='passes-assessed'?'The selected checks are met in this model. Unchecked landing hazards and operational support still need their own assessment.':result.outcome==='conditional'?'The numerical checks are met, but limitations in the inputs or supporting reports prevent an unconditional result.':'Set power, communication and evidence requirements before comparing results.'};
}

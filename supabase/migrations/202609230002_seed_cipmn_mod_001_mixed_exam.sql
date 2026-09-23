begin;

-- Replace only CIPMN-MOD-001. Other CIPMN modules and all non-CIPMN exams are untouched.
update public.examinations set exam_format='cipmn_mixed', updated_at=now() where id='2e5fea8b-a4de-5c61-9a43-e53e9d28403f';
update public.questions set is_active=false, position=position+1000, updated_at=now() where examination_id='2e5fea8b-a4de-5c61-9a43-e53e9d28403f' and is_active=true;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','Which statement best distinguishes a project from routine organizational operations?','single_choice','mcq',1,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('A project consists primarily of repetitive activities performed continuously.',1),('A project is a temporary and unique initiative with a defined start and finish.',2),('A project has no predetermined resource limitations.',3),('A project continues for as long as the organization remains operational.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project manager is reviewing a project to ensure that it will be completed on time, within available resources, and according to expected standards. Which purpose of project management is MOST directly reflected?','single_choice','mcq',2,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Eliminating all project uncertainties.',1),('Ensuring timely, cost-effective delivery while maintaining quality.',2),('Converting temporary projects into permanent operations.',3),('Removing stakeholders from project decision-making.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project team has completed initiation and now needs to establish the project scope, schedule and budget. Which project life-cycle phase should the team enter?','single_choice','mcq',3,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Execution.',1),('Closure.',2),('Planning.',3),('Monitoring and Controlling.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=3;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','During a road project, management approves a significant expansion of the project scope. According to the triple-constraint concept presented in the module, what should the project manager recognize?','single_choice','mcq',4,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Scope can change without affecting other project constraints.',1),('Changes to scope may affect time and cost.',2),('Only project quality will be affected.',3),('Cost automatically decreases whenever scope increases.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project manager wants to reduce resistance from an external community that will be affected by a new project. Based on the module, which action is MOST appropriate?','single_choice','mcq',5,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Engage the stakeholders early in the project.',1),('Restrict communication until project closure.',2),('Allow only internal stakeholders to participate.',3),('Engage the community only when a dispute occurs.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=1;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project team has clearly defined its objectives and identified its deliverables. The team now needs to decompose the project into manageable, deliverable-oriented components that will support scheduling and budgeting. What should it develop?','single_choice','mcq',6,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Risk register.',1),('Work Breakdown Structure.',2),('Power-Interest Matrix.',3),('Quality control chart.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','For a solar project, the panels must be delivered before installation, while installation must occur before testing. Which planning activity is being applied?','single_choice','mcq',7,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Stakeholder classification.',1),('Activity sequencing.',2),('Project closure.',3),('Resource leveling.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project has only one qualified electrician, but several activities initially require that electrician at the same time. Which technique described in the module should be used to produce a more balanced workload?','single_choice','mcq',8,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Resource leveling.',1),('Scope expansion.',2),('Project closure.',3),('Stakeholder mapping.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=1;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','During project implementation, actual progress is compared against established baselines and deviations are discovered. What should project control primarily do next?','single_choice','mcq',9,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Ignore the deviations until project closure.',1),('Apply corrective actions and manage deviations in scope, schedule and budget.',2),('Replace the project objectives with the actual results achieved.',3),('Stop collecting information about project performance.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project manager needs a visual schedule that shows project activities across time. Which scheduling technique identified in the module is appropriate?','single_choice','mcq',10,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('SWOT Analysis.',1),('Gantt Chart.',2),('Risk Assessment Matrix.',3),('Fishbone Diagram.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project team wants to identify the sequence of activities that determines the critical path of its project schedule. Which technique should it use?','single_choice','mcq',11,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Critical Path Method (CPM).',1),('Total Quality Management.',2),('Power-Interest Matrix.',3),('Resource Allocation.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=1;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project activity has an optimistic duration of 4 days, a most likely duration of 7 days, and a pessimistic duration of 10 days. Using PERT, what is the expected duration of the activity?','single_choice','mcq',12,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('6 days.',1),('7 days.',2),('8 days.',3),('9 days.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project manager is preparing a cost estimate and wants to improve its reliability using information from completed projects. What does the module recommend?','single_choice','mcq',13,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Rely exclusively on current stakeholder opinions.',1),('Use historical data for accuracy.',2),('Remove contingency from the estimate.',3),('Estimate only labour costs.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','An organization needs project-management software that improves task visibility while providing real-time dashboards and reports. According to the module, which consideration should ultimately guide its software choice?','single_choice','mcq',14,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('The number of stakeholders.',1),('Project complexity.',2),('The project manager job title.',3),('The age of the organization.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','Management wants indicators for assessing schedule and cost performance during project implementation. Which pair is explicitly identified in the module?','single_choice','mcq',15,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('SWOT and PERT.',1),('SPI and CPI.',2),('PDCA and DMAIC.',3),('WBS and CPM.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','Which of the following is identified in the module as a project monitoring tool or technique?','single_choice','mcq',16,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Earned Value Management.',1),('Power-Interest Matrix only.',2),('Employee appraisal.',3),('Organizational restructuring.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=1;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project team has identified a potential threat. According to the risk-management process presented in the module, what should the team do before planning treatment strategies?','single_choice','mcq',17,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Immediately close the project.',1),('Analyze its likelihood and impact, then evaluate and prioritize the threat.',2),('Transfer every identified threat to stakeholders.',3),('Remove the threat from the risk documentation.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project is experiencing repeated delays, emerging risks and growing dissatisfaction among stakeholders. The technical team insists that its responsibility is limited to completing assigned activities. Based on the project manager responsibilities presented in the module, which response is MOST appropriate?','single_choice','mcq',18,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Concentrate only on technical completion because stakeholder communication belongs to the sponsor.',1),('Monitor progress and risks, lead the team, and actively manage stakeholder communication.',2),('Suspend stakeholder engagement until the project returns to schedule.',3),('Transfer responsibility for project performance to individual team members.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','Previous project records show that 4 technicians completed a comparable installation in 2 days under similar conditions and scope. Which planning approach gives the project manager the strongest basis for the initial resource-duration estimate?','single_choice','mcq',19,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Use past project data as the basis for estimating resources and duration.',1),('Ignore previous performance and allocate the maximum available workforce.',2),('Determine the duration only after execution begins.',3),('Estimate the activity solely from the overall budget.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=1;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project estimates labour at ₦4,000,000, materials at ₦8,000,000 and logistics at ₦3,000,000. Management includes a 20% contingency. What should be the resulting project budget?','single_choice','mcq',20,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('₦15,000,000.',1),('₦16,500,000.',2),('₦18,000,000.',3),('₦20,000,000.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=3;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project rates four risks on 1–5 probability and impact scales: political instability 3×5, exchange-rate fluctuation 5×4, infrastructure failure 4×4, regulatory delay 2×5. Using Probability × Impact, which risk should receive the highest priority?','single_choice','mcq',21,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Political instability.',1),('Exchange-rate fluctuation.',2),('Infrastructure failure.',3),('Regulatory delay.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A solar-energy project has identified theft of installed solar panels as a significant risk. Which combination most closely follows the risk response presented in the module?','single_choice','mcq',22,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Increase the project budget and discontinue community communication.',1),('Hire local security and engage the community.',2),('Transfer responsibility for the panels to the supplier after installation.',3),('Accept the theft risk because it cannot be completely eliminated.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project is technically delivering its outputs, but management reports repeated rework, unnecessary waste, inconsistent compliance with required standards and declining stakeholder confidence in output quality. Which management area should receive the most direct attention?','single_choice','mcq',23,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Quality management.',1),('Activity sequencing.',2),('Stakeholder classification.',3),('Resource leveling.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=1;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','Organization X wants an organization-wide culture of continuous improvement involving employees and customer satisfaction. Organization Y wants targeted, data-driven defect reduction using DMAIC, control charts and process mapping. Which pairing is most consistent with the module?','single_choice','mcq',24,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('X = Six Sigma; Y = TQM.',1),('X = TQM; Y = Six Sigma.',2),('X = CPM; Y = TQM.',3),('X = PERT; Y = Six Sigma.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=2;

with q as (
 insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
 values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project team has completed all planned implementation activities. Management now wants the team to deliver the completed outputs, evaluate the results and capture lessons rather than continue treating it as active implementation. Which project life-cycle phase should now receive primary attention?','single_choice','mcq',25,1,true) returning id
), o as (
 insert into public.question_options(question_id,option_text,position)
 select q.id,v.option_text,v.position from q cross join (values ('Initiation.',1),('Planning.',2),('Monitoring and Controlling.',3),('Closure.',4)) v(option_text,position) returning id,question_id,position
)
insert into public.question_answer_keys(question_id,correct_option_id)
select o.question_id,o.id from o where o.position=4;

insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A state government has approved a solar-powered rural electrification project for a community. The project has a fixed completion deadline and limited budget. Key stakeholders include government officials, contractors, technicians and members of the beneficiary community. You have been appointed the Project Manager. Explain how you would develop the project plan. Address: (a) appropriate project objectives and major deliverables; (b) how you would use a Work Breakdown Structure (WBS); (c) how activities and dependencies should be identified and sequenced; (d) how resources and duration should be estimated; and (e) how the schedule, budget and major risks would be incorporated into the overall project plan. You are not required to draw a WBS or diagram.','theory','theory',26,1,true);

insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project has these activities: A = 3 days (no predecessor); B = 5 days (after A); C = 4 days (after A); D = 6 days (after B); E = 3 days (after C); F = 2 days (after D and E). Using the information provided: (a) identify the possible paths from start to completion; (b) calculate the duration of each path; (c) identify the critical path; (d) determine the minimum expected completion time; and (e) if Activity D is delayed by 3 days, explain the effect on expected completion time. Show calculations in text. You are not required to draw a network diagram.','theory','theory',27,1,true);

insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A public-sector project is halfway through implementation. Several activities are behind schedule; expenditure is increasing faster than expected; some previously identified risks are occurring; stakeholders complain about inadequate communication; and management is concerned that objectives may not be achieved. As Project Manager: (a) explain how you would assess current performance; (b) identify appropriate performance indicators and monitoring tools covered in the module; (c) distinguish monitoring from control and apply each; (d) recommend practical corrective actions; and (e) explain how continuous stakeholder engagement should contribute to the recovery strategy.','theory','theory',28,1,true);

insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A major project is experiencing exchange-rate fluctuations affecting procurement costs, regulatory approval delays, infrastructure challenges, repeated defects requiring rework, and growing dissatisfaction with output quality. As Project Manager: (a) identify issues that should be treated primarily as project risks and those requiring quality-management intervention; (b) explain how you would assess and prioritize the risks using likelihood and impact; (c) recommend treatment actions for the most significant risks; (d) explain how quality management could reduce waste and rework; and (e) compare TQM and Six Sigma as presented in the module and explain how either or both could improve quality performance.','theory','theory',29,1,true);

insert into public.questions(examination_id,question_text,question_type,section,position,points,is_active)
values('2e5fea8b-a4de-5c61-9a43-e53e9d28403f','A project team has completed all planned implementation activities and the outputs are ready for delivery. The Project Manager states: “The physical work has been completed, so the project is finished. There is no need for any further evaluation.” Critically assess this position. In your response: (a) identify the lifecycle phase reached; (b) explain what should happen to completed outputs; (c) explain why results should be evaluated; (d) discuss the importance of documenting lessons learned; and (e) explain how effective closure and lessons learned could improve future projects.','theory','theory',30,1,true);

commit;

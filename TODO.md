1. User creation form change a Display name -> Profile name
2. Add a teeam name to Quality Manager Role functionality 
3. When clicked shared in OPtion the it showes Acknlagments in other roles page. So it shodul be not choosen so agent can select.
4. Fatal issue is that when selected FATAL it shoudl have Numertal 0
5. 



i see that when one role choosed Acnoknaladgement in audit log table then in another agent role page i see that its auto Aknowladge so fix this dont make auto selected in agent role page so they can choose manually and see other data in audit log too .and in form page that in Feedback section that feedback status make pending as defualt  so user shoudl only able to change from Audit log not in that and in same feedback section there is data so remove that data from that so user can ony add date from audit log, and So in Analytic page also there isn Agent rank that is showing from top persantage so make it top many audited count to top auditor. 


# Required Changes

## 1. Audit Log Acknowledgement Status

* Currently, when one role selects **Shared** in the respective Roles Audit Log table, the same status in agent role page is automatically selected "Acknowledgement" that shoudld be "Shared" so agent can select there respective choosen .
* Fix this behavior.
* Users should manually choose their status.
* Other Audit Log data should remain visible to all roles.
* And remember one eole choosed shared then another role shoudl see that same data shared and that another user shoudl be able to choose there respective scopped options

## 2. Feedback Section Default Status

* In the Form page, under the **Feedback** section, set the default feedback status to **Pending**.
* Users should not be able to change the feedback status directly from the Form page.
* Feedback status updates should only be allowed through the **Audit Log**.
* And same to "Feedback Date" too it shoudl noe be able to choosen in form page.
* Users should only be able to add or update feedback information through the **Audit Log**.
* The Form page should display feedback information as read-only (if displayed at all).

## 4. Analytics Page - Agent Ranking

* Modify the **Agent Rank** calculation.
* Currently, ranking is based on percentage.
* Change the ranking criteria to use the **total number of completed audits**.
* Agents with the highest audited count should appear at the top of the ranking list.


1. User creation form change a Display name -> Profile name
2. Add a teeam name to Quality Manager Role functionality where while creating superviser user shoudl add team name too 
4. Fatal issue is that when selected FATAL it shoudl have Numertal 0, currently all calculation are good but in Fatal i see full score in form and by that its showing data little no accurate, 
# Site Blocker

## Goal
The Site Blocker is a chrome Extension which allows you to monitor the use of websites the way you want. 
It obviously emerged from the necessity I faced limiting my unproductive and (soon to be) unentertaining use of websites (like Youtube) and is a nudge helping me make a better use of my time according to my own conception.
This app is for the time being a personal side project closed to external contributions.

## Status
Under development.

## Requirements
* The Site Blocker should allow three type of restrictions :
  * by time slot;
  * by total time per day ;
  * by time in a row before a pause.
* The restrictions should have the following relations :
  * The time slot restriction is allmighty ;
  * if there is no slot restriction currently ongoing, the total time will be checked ;
  * if the total time has not been reached (or isn't defined), we'll look for how long one site or one group has been visited consecutively.
  * obviously, the total time and consecutive time of a group is the sum of those of the sites that belongs to it.
* The restrictions can be applied to both a group of sites and to individual sites.
  * The group restrictions is the primary one, and a site that belongs to a group can also have further restrictions that applies.
  * The restrictions of a site cannot override those of its group.
* The extension should keep records of how long the user has visited the site he added to the restricted ones and show some minimal visualisation for the duration of use of the sites.
 
## Currently
### Restrictions
[x] Time Slot Restriction
[x] Total Time Restriction
[x] Time in a Row Restriction
[] Customizable time of pause necessary before the time in a row gets reinitialized
### Service Worker
[x] Management of the alarms to fire beginning or end of restriction
[] Cleaning of the records to reduce the space taken by data
[] Customizable number of days stored in data
[] More precise system to calculate the total time per day
### Front
[x] Front overall behavior through web components
[] Shadow tree for cleaner HTML
[] CSS and design stuff
[] Side bar to navigate through the different pages of the extension
[] Data visualisation page

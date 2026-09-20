#!/bin/bash
# End-to-end smoke test against a running dev server (npm run dev)
B=localhost:4000/api; J='Content-Type: application/json'
A=$(mktemp); E=$(mktemp)
otp() { grep -o 'code is [0-9]*' /tmp/dev.log | tail -1 | awk '{print $3}'; }
login() { # jar email pw
  local c=$(curl -s -H "$J" -d "{\"email\":\"$2\",\"password\":\"$3\"}" $B/auth/login); echo "login: $c"
  local id=$(echo $c | grep -o '[0-9]*'); sleep 0.5
  curl -s -c $1 -H "$J" -d "{\"challengeId\":$id,\"code\":\"$(otp)\"}" $B/auth/verify; echo; }
echo "-- wrong domain:"; curl -s -H "$J" -d '{"email":"x@gmail.com","password":"ChangeMe-12345"}' $B/auth/login; echo
echo "-- admin login (pw + OTP):"; login $A ankit.kumar@bloom-india.com ChangeMe-12345
echo "-- create employee:"; curl -s -b $A -H "$J" -d '{"empId":"125","name":"Shashank Srivastava","email":"shashank@bloom-india.com","departmentId":3,"designation":"Engineer"}' $B/admin/users; echo
echo "-- non-bloom email rejected:"; curl -s -b $A -H "$J" -d '{"empId":"9","name":"X","email":"x@gmail.com"}' $B/admin/users; echo
echo "-- employee sets password via OTP:"
c=$(curl -s -H "$J" -d '{"email":"shashank@bloom-india.com"}' $B/auth/password/request); id=$(echo $c | grep -o '[0-9]*'); sleep 0.5
curl -s -H "$J" -d "{\"challengeId\":$id,\"code\":\"$(otp)\",\"password\":\"Employee-pass-1\"}" $B/auth/password/reset; echo
echo "-- employee login:"; login $E shashank@bloom-india.com Employee-pass-1
D=$(date +%F)
echo "-- fill slots 0-3 (proj 1, cat 1):"; curl -s -b $E -X PUT -H "$J" -d '{"entries":[{"slot":0,"projectId":1,"categoryId":1,"subcategoryId":2,"description":"DPR"},{"slot":1,"projectId":1},{"slot":2,"projectId":2},{"slot":3,"projectId":2}]}' $B/timesheets/$D | head -c 300; echo
echo "-- bad subcategory:"; curl -s -b $E -X PUT -H "$J" -d '{"entries":[{"slot":0,"projectId":1,"categoryId":3,"subcategoryId":2}]}' $B/timesheets/$D; echo
echo "-- slot 19 invalid:"; curl -s -b $E -X PUT -H "$J" -d '{"entries":[{"slot":19,"projectId":1}]}' $B/timesheets/$D; echo
echo "-- submit to admin (id 1):"; curl -s -b $E -H "$J" -d '{"reviewerId":1}' $B/timesheets/$D/submit | head -c 200; echo
echo "-- edit locked:"; curl -s -b $E -X PUT -H "$J" -d '{"entries":[]}' $B/timesheets/$D; echo
echo "-- mail to reviewer:"; grep -A3 "mail:dev.*Timesheet review" /tmp/dev.log | tail -4
echo "-- employee cannot see review:"; curl -s -b $E $B/reviews/1; echo
echo "-- pending for reviewer:"; curl -s -b $A "$B/reviews"; echo
echo "-- approve:"; curl -s -b $A -H "$J" -d '{"decision":"approved"}' $B/reviews/1/decision; echo
echo "-- month summary:"; curl -s -b $E "$B/summary/month?month=$(date +%Y-%m)"; echo
echo "-- csv:"; curl -s -b $E "$B/summary/month.csv?month=$(date +%Y-%m)"; echo
echo "-- employee blocked from admin:"; curl -s -b $E $B/admin/users; echo

#!/bin/sh
#curl -X POST --header "Content-Type: application/json" --header "Accept: application/json" -d "{\"name\":\"Agathe\"}" "http://localhost:8080/api/clients/"
curl -X POST --user user-test:password-test --header "Content-Type: application/json" --header "Accept: application/json" -d "{\"name\":\"Bertille\"}" "http://localhost:8080/api/clients/"

curl --user user-test:password-test --header "Content-Type: application/json" --header "Accept: application/json" "http://localhost:8080/api/clients/"

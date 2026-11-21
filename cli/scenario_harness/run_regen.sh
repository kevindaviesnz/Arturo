#!/usr/bin/env bash
set -uo pipefail
cd /Users/kevindavies/Development/AI/Arturo/cli
declare -A N=(
 [001]="Solar customer education" [003]="Legal contract review" [004]="Insurance claim triage"
 [005]="Discovery research framing" [006]="Investment assessment" [007]="Climate evidence synthesis"
 [008]="Cybersecurity incident response" [009]="Therapeutic target assessment" [010]="Security incident investigation"
 [011]="Synthesis strategy review loop" [014]="SaaS support triage on a schedule" [015]="HR policy drafting with house style"
 [016]="Manufacturing QA reject then approve" [017]="Public-sector FOI delegation" [018]="Financial compliance monitoring"
 [019]="Newsroom fact-check desk" [020]="Clinical trial protocol framing" [022]="University research administration"
 [024]="Airline disruption management" [025]="Charity safeguarding intake" [026]="Hospital patient flow"
 [027]="Bank lending review" [028]="Editorial pipeline event chain" [029]="Standards document versioning"
 [030]="Conservation operations" [031]="Agricultural advisory" [032]="Water utility operations"
 [033]="Aviation maintenance planning" [034]="Online platform trust and safety" [035]="Telecom NOC event chain"
 [036]="Retail supply chain planning" [037]="Government benefits assessment" [038]="Pharmaceutical manufacturing deviation"
 [039]="Port logistics health" [040]="Cost estimation from an Artefact" [041]="Museum acquisition ethics"
 [042]="Real estate development feasibility" [043]="Mining operations safety" [044]="Food safety recall assessment"
 [045]="Academic integrity review" [046]="Waste management route planning" [047]="Disaster recovery coordination"
 [048]="Smart port operations" [049]="Integrated health system"
)
ORDER="001 003 004 005 006 007 008 009 010 011 014 015 016 017 018 019 020 022 024 025 026 027 028 029 030 031 032 033 034 035 036 037 038 039 040 041 042 043 044 045 046 047 048 049"
for n in $ORDER; do
  scenario_harness/run_wave.sh "$n|${N[$n]}"
done
# 013 runs on the demo seed
echo "########## 013 (demo) ##########"
scenario_harness/run_scenario_demo.sh scenario_harness/plans/013.plan s013 "/Users/kevindavies/Development/AI/Arturo/scenario_testing/.raw-013.txt"
scenario_harness/txt_to_md.sh "/Users/kevindavies/Development/AI/Arturo/scenario_testing/.raw-013.txt" "/Users/kevindavies/Development/AI/Arturo/scenario_testing/Scenario 013 — A week in a sole legal practice.md" "Scenario 013 — A week in a sole legal practice"
rm -f "/Users/kevindavies/Development/AI/Arturo/scenario_testing/.raw-013.txt"
echo "REGEN ALL DONE"

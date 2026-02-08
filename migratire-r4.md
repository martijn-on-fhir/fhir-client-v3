Rapport Bert: Technische Vereisten voor Multi-FHIR-Versie Ondersteuning
Huidige Situatie
De applicatie is primair gebouwd voor FHIR STU3, maar heeft al type definities (r3.d.ts, r4.d.ts, r4b.d.ts, r5.d.ts) en een validator die STU3 en R4 kent. De basis is dus al deels aanwezig.

Belangrijkste Bevindingen
Goed nieuws:

Type definities voor alle versies bestaan al in src/app/shared/types/
De FhirService is versie-agnostisch (doet puur HTTP requests)
fhirpath library werkt met alle versies
De validator kent al R4 en STU3 resource lijsten
CapabilityStatement metadata wordt al gelezen (incl. fhirVersion)
Knelpunten:

R3TypesService is hardcoded als enige bron voor autocomplete
ServerProfile model slaat geen FHIR versie op
QueryAutocompleteService injecteert direct R3TypesService
SubscriptionService is volledig STU3-specifiek
Validator bepaalt versie hardcoded op basis van profielnaam
Concrete Stappen (6 fasen)
Basis infrastructuur - fhirVersion toevoegen aan ServerProfile, auto-detect service
Type System - R4/R4B/R5 TypesServices maken, central FhirTypesService facade
Validator uitbreiden - Alle versies ondersteunen op basis van actief profiel
Subscriptions herwerken - R5 topic-based subscriptions (laag prio, STU3-stijl werkt in R4)
UI updates - Versie-indicator, selectors
Testing - Resource compatibility matrix, edge cases
MVP schatting: 6-8 weken (alleen R4 toevoegen naast STU3)

Rapport Mike: Interface Consequenties
Applicatie Structuur
Angular 18.2 Electron app met Bootstrap 5, Monaco Editor, 16 feature tabs, 20+ shared components.

Aanpassingen gerangschikt op impact:
HOOG IMPACT (5 wijzigingen):

Component	Wijziging
Server Profile Dialog	FHIR Version selector toevoegen
Header	Version badge (kleurgecodeerd)
Query Builder	Versie-gefilterde resource types dropdown
Validator	Alle FHIR versies ondersteunen
Sidebar	Resource type badges (New/Deprecated)
MIDDEL IMPACT (6 wijzigingen):

Server Info Dialog: version mismatch warnings
Resource Info: versie-aware search parameters
Terminology: versie-specifieke CodeSystem defaults
FHIRPath evaluator: versie-context voor functies
Profiles Browser: versie-filtering
Autocomplete Service: versie-bewuste suggesties
LAAG IMPACT (7 wijzigingen):

About Dialog, Settings, Error Messages, Query History, Bulk Import/Export, Monaco Editor hints, Reference Graph
Totaal: 18 componenten, 27 specifieke wijzigingen
Gedeelde Conclusie
Beide onderzoekers zijn het eens: de applicatie heeft een goede basis voor multi-versie ondersteuning. De eerste stap is altijd fhirVersion toevoegen aan het ServerProfile model met auto-detect vanuit het CapabilityStatement. Van daaruit kan de rest incrementeel worden opgebouwd. Een MVP met alleen R4-ondersteuning erbij is haalbaar in 6-8 weken.

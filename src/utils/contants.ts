export const modelsMapping = {
    "coverLetter": "ft:gpt-3.5-turbo-0125:construction-check::9nkaCtuv",
    "purposeSection": "ft:gpt-3.5-turbo-0125:construction-check::9njVk7Ne",
    "projectTaskDescription": "ft:gpt-3.5-turbo-0125:construction-check::9npKxmxl"
}


export const preContext = {
    "coverLetter": "I am a helpful assitant, I help customers with estimates for their construction projects",
    "purposeSection": " I am a helpful assitant, I help customers with estimates for their construction projects",
    "projectTaskDescription": "I am a helpful assitant, I help customers with estimates for their construction projects"
}

// utils/constants.ts

export const basisOfEstimateData = {
    biddingAssumptions: [
        "The following bidding assumptions were considered in the development of this estimate:",
        "It is assumed that the Project shall be publicly bid to multiple pre-qualified Prime Contractors with successful experience in the Project Type Size and Schedule. It is also assumed that:",
        "Bidders Prime and Sub-Prime will hold a valid active current Contractor’s license in their general trade and activity and the current required credentials applicable to the Project to be able to conduct work in [LOCATION].",
        "Bidders will develop bids with a competitive approach to material pricing and labor productivity and will not include allowance for changes extra work unforeseen conditions or any other unplanned cost.",
        "Estimate costs in the OPC are based on a minimum of four (4) bidders. Actual bids may increase if there are fewer bidders or decrease for a greater number of bidders.",
        "All bidders are to include costs for plan review and permit fees for any and all required governing agency required approvals.",
        "All bidders are to include bonding for the total project and hold the Owner design team and others harmless.",
        "All appropriate taxes are to be included in bids.",
        "All appropriate insurances to be included in bid.",
        "All bids are to include equal business opportunity (EBO) participation and provide certification of all Sub-Primes claiming certification."
    ],
    riskAndOpportunities: {
        description: "The estimate includes and was developed utilizing the information supplied by [CLIENT] [CC CUSTOMER] Project Engineers and CC research and establishes the Project Parameters as:",
        parameters: [
            { key: "Project or WBS Number", value: "[PROJECT NUMBER]" },
            { key: "Project Manager", value: "[CC PROJECT MANAGER]" },
            { key: "Estimation Software", value: "[Software] Picklist - Success Version: 9.1.0.1 Excel Mii etc." },
            { key: "WBS Template", value: "[WBS Template] Picklist or add entry can be N/A" },
            { key: "Libraries", value: "[USER INPUT – Free form]" },
            { key: "Date of Estimate", value: "[Today’s Date – create revision on each generation]" },
            { key: "Revision Number", value: "[GENERATED]" },
            { key: "File name", value: "[Project Name]" },
            { key: "Project Location", value: "[LOCATION]" },
            { key: "Projected Project Start", value: "[USER INPUT - Construction Start Date M-Y] – can be NA" },
            { key: "Tax Rate", value: "[Pick list 1-30%]" },
            { key: "Prime O/P Fee", value: "[Pick list 1-30%] included in OPC" },
            { key: "Sub-Prime O/P Fee", value: "[Pick list 1-30%] include in OPC" },
            { key: "Labor Rates & Burden", value: "Varies with discipline refer to OPC estimate attached." },
            { key: "Escalation Rate", value: "[X.XX% Input] calculated – can be NA" }
        ]
    },
    projectPhysicalScope: {
        description: "The allowances were calculated utilizing [USER INPUT] supplied by [Picklist – CC Customer or Client] The adjustments included in the estimate are:",
        allowances: [
            { type: "Design Evolution", percentage: "[Picklist 1-20.00%] of Direct and Indirect Costs" },
            { type: "Misc. Modifications", percentage: "[Picklist 1-20.00%] of Direct and Indirect Costs" },
            { type: "Bid Allowance", percentage: "[Picklist 1-20.00%] of Direct and Indirect Costs" },
            { type: "Escalation", percentage: "[Picklist 1-20.00%] of Direct and Indirect Costs" }
        ]
    },
    excludedCosts: [
        "Legal fees related to project disputes.",
        "Costs related to unforeseen environmental remediation.",
        "Costs associated with changes requested after final approval."
    ],
    contractorEstimateMarkups: {
        description: "Estimate Markups",
        items: [
            { item: "Prime Contractor (items below as applicable to Project)", ratePercent: "[Picklist 0-20.0%]" },
            { item: "Subcontractor (if not lump sum; otherwise same as Prime)", ratePercent: "[Picklist 0-30.0%] select value or percentage if percentage picklist else dollar amount" },
            { item: "Labor (employer payroll burden)", ratePercent: "From [Picklist 1-100] to [Picklist 1-100]" },
            { item: "Materials and process equipment", ratePercent: "From [Picklist 1-100] to [Picklist 1-100]" },
            { item: "Equipment (construction-related)", ratePercent: "From [Picklist 1-100] to [Picklist 1-100]" },
            { item: "Sales Tax (State and local for materials process & rentals)", ratePercent: "[Picklist 0-20.0%]" },
            { item: "Startup Training O&M", ratePercent: "From [Picklist 1-5] to [Picklist 1-10]" },
            { item: "Builders Risk Liability and Vehicle Insurance", ratePercent: "From [Picklist 1.0-5.0] to [Picklist 1.0-10.0]" },
            { item: "Material Shipping and Handling", ratePercent: "From [Picklist 1.0-5.0] to [Picklist 1.0-10.0]" },
            { item: "Performance and Payment Bonds", ratePercent: "From [Picklist 1.0-5.0] to [Picklist 1.0-10.0]" },
            { item: "Contingencies - Separated by CC Design Team & Owner", ratePercent: "[Picklist 0-20.0]" }
        ]
    },
    exclusions: [
        "Work beyond the property line.",
        "Furniture and equipment not specified in the contract.",
        "Permits and fees not included in the initial agreement."
    ],
    exceptions: [
        "Special conditions for weather delays.",
        "Changes in material costs beyond a 5% threshold.",
        "Additional work requested by the client after project start."
    ],
    reconciliation: [
        { category: "Labor", initialEstimate: 100000, finalEstimate: 110000 },
        { category: "Materials", initialEstimate: 150000, finalEstimate: 145000 },
        { category: "Equipment", initialEstimate: 50000, finalEstimate: 52000 }
    ]
};

const sampleData = {
    "pkType": "project",
    "accountId": "9aa1dcfd-db06-433b-8319-86c0a123e566",
    "providerId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
    "officeId": "75b8958c-f127-4e67-8f8e-450ea758be0f",
    "status": 3,
    "statusHistory": [
        {
            "oldStatus": 2,
            "newStatus": 3,
            "byUserId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
            "createdAt": "2024-04-04T20:04:22.823464+00:00"
        },
        {
            "oldStatus": 0,
            "newStatus": 2,
            "byUserId": "9aa1dcfd-db06-433b-8319-86c0a123e566",
            "createdAt": "2024-04-01T02:36:57.624171+00:00",
            "metadata": [
                {
                    "name": "reason",
                    "value": "Project (Submitted) submitted to provider"
                }
            ]
        },
        {
            "oldStatus": 0,
            "newStatus": 0,
            "byUserId": "9aa1dcfd-db06-433b-8319-86c0a123e566",
            "createdAt": "2024-04-01T02:35:29.214282+00:00"
        }
    ],
    "submittedAt": "2024-04-01T02:36:57.624385+00:00",
    "name": "Mar 31 - New Client123",
    "projectTypeId": "46ddfa2c-e6b5-4668-bf5f-483494a814f9",
    "location": {
        "municipality": "Cumming",
        "freeformAddress": "Cumming, GA",
        "country": "United States",
        "countryCode": "US",
        "countrySubdivision": "GA",
        "countrySubdivisionName": "Georgia",
        "lat": 34.207048,
        "lon": -84.140359
    },
    "constructionType": 0,
    "deliveryMethod": 0,
    "estimateType": 0,
    "phases": [
        {
            "id": "ea991846-dd72-4b2c-9d28-f5f90df85c91",
            "createdAt": "2024-04-01T02:35:59.66501+00:00",
            "updatedAt": "2024-04-01T02:36:57.624236+00:00",
            "status": 3,
            "statusHistory": [
                {
                    "oldStatus": 2,
                    "newStatus": 3,
                    "byUserId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
                    "createdAt": "2024-04-04T20:04:22.842735+00:00",
                    "metadata": [
                        {
                            "name": "reason",
                            "value": "Phase (Submitted) accepted during project acceptance."
                        }
                    ]
                },
                {
                    "oldStatus": 1,
                    "newStatus": 2,
                    "byUserId": "9aa1dcfd-db06-433b-8319-86c0a123e566",
                    "createdAt": "2024-04-01T02:36:57.624787+00:00",
                    "metadata": [
                        {
                            "name": "reason",
                            "value": "Phase (New) submitted during project submission."
                        }
                    ]
                },
                {
                    "oldStatus": 0,
                    "newStatus": 1,
                    "byUserId": "9aa1dcfd-db06-433b-8319-86c0a123e566",
                    "createdAt": "2024-04-01T02:35:59.666075+00:00"
                },
                {
                    "oldStatus": 1,
                    "newStatus": 0,
                    "byUserId": "9aa1dcfd-db06-433b-8319-86c0a123e566",
                    "createdAt": "2024-04-01T02:35:59.665011+00:00",
                    "metadata": [
                        {
                            "name": "reason",
                            "value": "New phase added with project status (Draft)."
                        }
                    ]
                }
            ],
            "phaseType": 0,
            "sequence": 0,
            "submissionDate": "2024-04-01T04:00:00+00:00",
            "deliveryDate": "2024-04-22T04:00:00+00:00",
            "estimates": [
                {
                    "id": "84067e04-f020-4658-9c94-d84c46453e6a",
                    "createdAt": "2024-04-01T02:36:57.695822+00:00",
                    "updatedAt": "2024-04-01T02:36:57.695822+00:00",
                    "discipline": 5,
                    "baseRate": 125,
                    "levelOfEffortHours": 23,
                    "manualBaseRate": 125,
                    "manualLevelOfEffortHours": 23,
                    "difficulty": 0
                },
                {
                    "id": "61969910-040f-4b34-ad92-96aecbe4066a",
                    "createdAt": "2024-04-01T02:36:57.693395+00:00",
                    "updatedAt": "2024-04-01T02:36:57.693395+00:00",
                    "discipline": 1,
                    "baseRate": 145,
                    "levelOfEffortHours": 8,
                    "manualBaseRate": 145,
                    "manualLevelOfEffortHours": 8,
                    "difficulty": 0,
                    "labor": [
                        {
                            "id": "44e5883b-5115-41f0-a548-6d56bba02ec6",
                            "status": 7,
                            "statusHistory": [
                                {
                                    "oldStatus": 7,
                                    "newStatus": 7,
                                    "byUserId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
                                    "createdAt": "2024-04-04T20:04:22.845331+00:00",
                                    "metadata": [
                                        {
                                            "name": "reason",
                                            "value": "Labor created and approved for the ProjectManagement."
                                        }
                                    ]
                                }
                            ],
                            "userId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
                            "rate": 0,
                            "split": 1,
                            "hours": 8,
                            "skills": [],
                            "createdAt": "2024-04-04T20:04:22.844723+00:00",
                            "updatedAt": "2024-04-04T20:04:22.844723+00:00"
                        }
                    ]
                },
                {
                    "id": "5b9ea03f-098a-4f32-9b8c-c9cc92700dfa",
                    "createdAt": "2024-04-01T02:36:57.695825+00:00",
                    "updatedAt": "2024-04-01T02:36:57.695825+00:00",
                    "discipline": 3,
                    "baseRate": 97.5,
                    "levelOfEffortHours": 23,
                    "manualBaseRate": 97.5,
                    "manualLevelOfEffortHours": 23,
                    "difficulty": 0
                },
                {
                    "id": "a9a660c4-e734-46e0-a12d-c6d374517374",
                    "createdAt": "2024-04-01T02:36:57.694169+00:00",
                    "updatedAt": "2024-04-01T02:36:57.694169+00:00",
                    "discipline": 6,
                    "baseRate": 125,
                    "levelOfEffortHours": 2,
                    "manualBaseRate": 125,
                    "manualLevelOfEffortHours": 2,
                    "difficulty": 0
                },
                {
                    "id": "f937cec3-0ec8-40a4-a0c9-869f564c24b5",
                    "createdAt": "2024-04-01T02:36:57.694172+00:00",
                    "updatedAt": "2024-04-01T02:36:57.694172+00:00",
                    "discipline": 0,
                    "baseRate": 165,
                    "levelOfEffortHours": 1,
                    "manualBaseRate": 165,
                    "manualLevelOfEffortHours": 1,
                    "difficulty": 0,
                    "labor": [
                        {
                            "id": "7b464df9-b53a-46b1-b2e0-29965a00fa6d",
                            "status": 7,
                            "statusHistory": [
                                {
                                    "oldStatus": 7,
                                    "newStatus": 7,
                                    "byUserId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
                                    "createdAt": "2024-04-04T20:04:22.846434+00:00",
                                    "metadata": [
                                        {
                                            "name": "reason",
                                            "value": "Labor created and approved for the ProjectPrincipal."
                                        }
                                    ]
                                }
                            ],
                            "userId": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
                            "rate": 0,
                            "split": 1,
                            "hours": 1,
                            "skills": [],
                            "createdAt": "2024-04-04T20:04:22.846432+00:00",
                            "updatedAt": "2024-04-04T20:04:22.846432+00:00"
                        }
                    ]
                },
                {
                    "id": "079e91e2-0ae7-4509-b6de-3fc16e172280",
                    "createdAt": "2024-04-01T02:36:57.694173+00:00",
                    "updatedAt": "2024-04-01T02:36:57.694173+00:00",
                    "discipline": 7,
                    "baseRate": 40,
                    "levelOfEffortHours": 2,
                    "manualBaseRate": 40,
                    "manualLevelOfEffortHours": 2,
                    "difficulty": 0
                },
                {
                    "id": "2215129e-2a24-4f8c-a3ee-df2898d62c2e",
                    "createdAt": "2024-04-01T02:36:57.695825+00:00",
                    "updatedAt": "2024-04-01T02:36:57.695825+00:00",
                    "discipline": 2,
                    "baseRate": 125,
                    "levelOfEffortHours": 23,
                    "manualBaseRate": 125,
                    "manualLevelOfEffortHours": 23,
                    "difficulty": 0
                },
                {
                    "id": "d8aa1485-1f8e-4b3b-8376-29d7e1ff668d",
                    "createdAt": "2024-04-01T02:36:57.695826+00:00",
                    "updatedAt": "2024-04-01T02:36:57.695826+00:00",
                    "discipline": 4,
                    "baseRate": 125,
                    "levelOfEffortHours": 23,
                    "manualBaseRate": 125,
                    "manualLevelOfEffortHours": 23,
                    "difficulty": 0
                },
                {
                    "id": "89e7d503-4b77-4808-9b6e-fe15d5e3d2cf",
                    "createdAt": "2024-04-01T02:36:57.694175+00:00",
                    "updatedAt": "2024-04-01T02:36:57.694175+00:00",
                    "discipline": 8,
                    "baseRate": 165,
                    "levelOfEffortHours": 0,
                    "manualBaseRate": 165,
                    "manualLevelOfEffortHours": 0,
                    "difficulty": 0
                }
            ],
            "fee": 12690,
            "feeWeight": 1,
            "manualFee": 12690,
            "manualFeeWeight": 1,
            "variations": [],
            "otherFees": [
                {
                    "name": "$FeeRemaining$",
                    "amount": 167.5
                }
            ],
            "providerFee": 500
        }
    ],
    "projectNumber": "123",
    "taskOrderNumber": "123",
    "budget": {
        "isFixed": false,
        "range": 3
    },
    "procurementMethod": 0,
    "resourceUsers": [
        {
            "id": "9aa1dcfd-db06-433b-8319-86c0a123e566",
            "role": 0,
            "createdAt": "2024-04-01T02:35:29.214294+00:00",
            "isClient": true
        },
        {
            "id": "c9982498-d763-490d-a8fa-de8e7a6a1f24",
            "role": 0,
            "createdAt": "2024-04-04T20:04:22.841002+00:00",
            "isProvider": true
        }
    ],
    "pkFilter": "20240401",
    "id": "c7b880e0-53c1-4a18-b027-eb8dc6620fca",
    "createdAt": "2024-04-01T02:35:28.70713+00:00",
    "createdById": "9aa1dcfd-db06-433b-8319-86c0a123e566",
    "updatedAt": "2024-04-05T01:52:23.020848+00:00",
    "updatedById": "9aa1dcfd-db06-433b-8319-86c0a123e566",
    "_rid": "1xwXAIqsryJqAQAAAAAAAA==",
    "_self": "dbs/1xwXAA==/colls/1xwXAIqsryI=/docs/1xwXAIqsryJqAQAAAAAAAA==/",
    "_etag": "\"09003047-0000-0200-0000-661b60bf0000\"",
    "_attachments": "attachments/",
    "_ts": 1713070271
}
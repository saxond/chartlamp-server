export interface BasisOfEstimateInput {
    projectTitle: string;
    projectLocation: string;
    projectPhase: string;
    clientName: string;
    ccCustomer: string;
    projectNumber: string;
    scopeDescription: string;
    ccProjectManager: string;
    estimationSoftware: string;
    wbsTemplate: string;
    libraries: string;
    dateOfEstimate: string;
    revisionNumber: string;
    fileName: string;
    constructionStartDate: string;
    taxRate: string;
    primeOPFee: string;
    subPrimeOPFee: string;
    laborRatesBurden: string;
    escalationRate: string;
    programDeliveryAllowances: {
      designEvolution: string;
      miscModifications: string;
      bidAllowance: string;
      escalation: string;
    };
    excludedCosts: string[];
    contractorEstimateMarkups: {
      primeContractorMarkup: string;
      subcontractorMarkup: string;
      laborMarkupRange: { from: string; to: string };
      materialsProcessEquipmentMarkupRange: { from: string; to: string };
      constructionEquipmentMarkupRange: { from: string; to: string };
      salesTax: string;
      startupTrainingOMMarkupRange: { from: string; to: string };
      buildersRiskLiabilityInsuranceMarkupRange: { from: string; to: string };
      materialShippingHandlingMarkupRange: { from: string; to: string };
      performancePaymentBondsMarkupRange: { from: string; to: string };
      contingenciesMarkup: string;
    };
    escalationScenario: {
      constructionStartFirstPhase: string;
      constructionStartMajorityWork: string;
      constructionDurationMajorWork: string;
      escalationMidpoint: string;
      annualEscalationRate: string;
    };
    managementReserveContingency: string;
    projectExclusions: string[];
    projectExceptions: string[];
    reconciliationReport: {
      included: boolean;
      summary: string;
    };
    benchmarking: string;
  }
  
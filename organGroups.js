// Coarse display groups combine existing meshes; these do not merge geometry
// or assert an anatomical ontology. First matching rule owns each model.
const GROUPS = {
    'organs.digestive': [
        ['mouth', 'Mund & Zunge', /gingiva|tongue|tooth|teeth|molar|premolar|incisor/i],
        ['salivary', 'Speicheldrüsen', /submandibular|sublingual|parotid|salivary/i],
        ['esophagus', 'Speiseröhre', /esophagus|oesophagus/i],
        ['stomach', 'Magen', /stomach/i],
        ['smallIntestine', 'Dünndarm', /duodenum|jejunum|ileum|mesentery of small intestine/i],
        ['largeIntestine', 'Dickdarm', /colon|rectum|appendix|mesoappendix|cecum|caecum|ileocecal|taenia/i],
        ['liver', 'Leber', /liver|hepatovenous|hepatic|biliary tree/i],
        ['gallbladder', 'Gallenblase', /gallbladder|gall bladder|cystic duct/i],
        ['pancreas', 'Bauchspeicheldrüse', /pancrea/i],
    ],
    'organs.respiratory': [
        ['trachea', 'Luftröhre', /trachea/i],
        ['bronchi', 'Bronchien', /bronch/i],
        ['lungs', 'Lunge', /lung|pulmonary lobe/i],
        ['larynx', 'Kehlkopf', /larynx|laryngeal|cricoid|thyroid cartilage/i],
        ['nose', 'Nase', /nasal|alar/i],
    ],
    'organs.urogenital': [
        ['kidneyLeft', 'Linke Niere', /left kidney/i],
        ['kidneyRight', 'Rechte Niere', /right kidney/i],
        ['ureters', 'Harnleiter', /ureter/i],
        ['bladder', 'Harnblase', /bladder/i],
        ['urethra', 'Harnröhre', /urethra/i],
        ['prostate', 'Prostata', /prostate/i],
        ['reproductive', 'Weitere Geschlechtsorgane', /testis|testicle|epididymis|penis|seminal|ductus deferens|ovary|uterus|vagina/i],
    ],
    'organs.nervous': [
        ['spinalCord', 'Rückenmark', /spinal cord/i],
        ['ventricles', 'Hirnventrikel & Liquorwege', /ventricle|cerebral aqueduct/i],
        ['cerebellum', 'Kleinhirn', /cerebell|vermis/i],
        ['brainstem', 'Hirnstamm', /midbrain|medulla oblongata|pons|colliculus/i],
        ['diencephalon', 'Zwischenhirn', /thalamus|hypothalamus|habenula|tuber cinereum/i],
        ['cerebrum', 'Großhirn', /gyrus|gyri|hippocamp|insula|internal capsule|cerebral hemisphere|occipital lobe|parietal lobule|amygdala|putamen|pallidum|caudate|fornix|corpus callosum/i],
        ['nerves', 'Nerven', /nerve/i],
    ],
    'organs.senses': [
        ['eyeLeft', 'Linkes Auge & Tränenapparat', /left/i],
        ['eyeRight', 'Rechtes Auge & Tränenapparat', /right/i],
    ],
    'organs.endocrine': [
        ['adrenal', 'Nebennieren', /adrenal/i],
        ['pituitary', 'Hypophyse', /pituitary/i],
        ['pineal', 'Zirbeldrüse', /pineal/i],
        ['thyroid', 'Schilddrüse & Nebenschilddrüsen', /thyroid/i],
    ],
    'organs.lymphatic': [
        ['thymus', 'Thymus', /thymus/i],
        ['spleen', 'Milz', /spleen/i],
        ['lymph', 'Lymphstrukturen', /lymph/i],
    ],
};

export function getOrganDisplayGroups(categoryId, models) {
    const definitions = GROUPS[categoryId];
    if (!definitions) return [];
    const buckets = definitions.map(([id, label]) => ({ id: `${categoryId}.${id}`, label, models: [] }));
    const other = { id: `${categoryId}.other`, label: 'Weitere Strukturen', models: [] };
    for (const model of models) {
        const index = definitions.findIndex(([, , pattern]) => pattern.test(model.nameEn));
        (index === -1 ? other : buckets[index]).models.push(model);
    }
    return [...buckets, other].filter(group => group.models.length);
}

import {ActorSheetContext, computeTotalValue} from "./foundry";
import {Armor, ItemWrapper} from "./item/item";

export function computeProtection(actorData: ActorSheetContext) {
    let prNat = 0;
    let prMag = 0;

    for (let [k, v] of Object.entries(actorData.data.stuff.armor)) {
        const element: ItemWrapper<Armor> = v;
        if (!element) {
            continue;
        }
        if (element.data.protections.natural) {
            prNat += element.data.protections.natural;
        }
        if (element.data.protections.magical) {
            prMag += element.data.protections.magical;
        }
    }

    if (!actorData.data.protections.natural) {
        actorData.data.protections.natural = {value:0, total:0, mod:0, temp:0};
    }
    if (!actorData.data.protections.magical) {
        actorData.data.protections.magical = {value:0, total:0, mod:0, temp:0};
    }
    actorData.data.protections.natural.value = prNat;
    actorData.data.protections.magical.value = prMag;
    computeTotalValue(actorData.data.protections.natural);
    computeTotalValue(actorData.data.protections.magical);

    actorData.data.protections.total = actorData.data.protections.natural.total +
        actorData.data.protections.magical.total;
}
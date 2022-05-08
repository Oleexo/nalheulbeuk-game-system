import { getAvailableJobs } from '../../core/data/job';
import { getAvailableOrigins } from '../../core/data/origin';
import {onManageActiveEffect, prepareActiveEffectCategories} from "../helpers/effects.mjs";
import {computeProtection} from "../../core/data/protection";
import { chatService } from '../../core/chat-service';
import { RollType } from '../../core/utils/roll-type';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class NaheulbeukActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["naheulbeuk", "sheet", "actor"],
      template: "systems/naheulbeuk/templates/actor/actor-sheet.html",
      width: 1200,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  /** @override */
  get template() {
    return `systems/naheulbeuk/templates/actor/actor-${this.actor.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.actor.data.toObject(false);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.data = actorData.data;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);
    
    context.sexes = this.getSexes();
    context.origins = [
      { label: "nhb.actor.sheet.pick-origin", name: "" },
      ...getAvailableOrigins(actorData.data.stats)
    ];
    context.jobs = [
      { label: "nhb.actor.sheet.pick-job", name: "" },
      ...getAvailableJobs(actorData.data.stats, actorData.data.attributes.origin)
    ];
    return context;
  }

  getSexes() {
    return [
      { label: "nhb.actor.sheet.pick-sex", value: "" },
      { label: "nhb.actor.sex.male", value: "male" },
      { label: "nhb.actor.sex.female", value: "female"},
      { label: "nhb.actor.sex.other", value: "other" },
    ];
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    computeProtection(context);
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const features = [];
    const spells = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: []
    };

    let tbr = [];
    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;

      if (i.type === 'feature') {
        features.push(i);
      }
      // Append to spells.
      else if (i.type === 'spell') {
        if (i.data.spellLevel != undefined) {
          spells[i.data.spellLevel].push(i);
        }
      } else if (i.type === 'armor') {
        if (context.data.stuff.armor[i.data.position]) {
          if (context.data.stuff.armor[i.data.position]._id === i._id) {
            context.data.stuff.armor[i.data.position] = i;
          } else {
            tbr.push(i);
          }
        } else {
          context.data.stuff.armor[i.data.position] = i;
        }
      } else if (i.type === 'melee-weapon' || i.type === 'range-weapon') {
        context.data.stuff.weapons.push(i);
      }
    }

    for (let i of tbr) {
      let item = this.actor.items.get(i._id);
      item.delete();
    }

    // Assign and return
    context.features = features;
    context.spells = spells;
   }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    html.find('.rollable-ability').click(this.onAbilityRoll.bind(this));

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.owner) {
      let handler = ev => {
        this._onDragStart(ev);
      }
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  async onAbilityRoll(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;

    chatService.sendRoll(RollType.ABILITY,
      Roll.fromTerms([
        new DiceTerm({faces: 20}),
      ]), {
        ability,
        ...this.actor.data.data.stats[ability]
      });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    if (type === 'armor') {
      itemData.position = header.dataset.position;
    }

    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[roll] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

}

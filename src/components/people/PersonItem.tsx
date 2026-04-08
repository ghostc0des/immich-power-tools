import { IPerson } from "@/types/person";
import React, { useRef, useState } from "react";
import { mergePerson, searchPeople, updatePerson } from "@/handlers/api/people.handler";
import { PersonMergeDropdown } from "./PersonMergeDropdown";
import PersonBirthdayCell from "./PersonBirthdayCell";
import clsx from "clsx";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Info } from "lucide-react";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "../ui/use-toast";
import ShareAssetsTrigger from "../shared/ShareAssetsTrigger";
import { Autocomplete, AutocompleteOption } from "../ui/autocomplete";
import { AlertDialog, IAlertDialogActions } from "../ui/alert-dialog";

interface IProps {
  person: IPerson;
  onRemove: (person: IPerson) => void;
}

export default function PersonItem({ person, onRemove }: IProps) {
  const { exImmichUrl } = useConfig();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(person);
  const selectedPerson = useRef<AutocompleteOption | null>(null);
  const mergeDialogRef = useRef<IAlertDialogActions>(null);

  const handleEdit = () => {
    if (formData.name && formData.name !== person.name) {
      setLoading(true);
      return updatePerson(person.id, { name: formData.name })
        .then(() => {
          setEditMode(false);
          toast({ title: "Success", description: "Person updated successfully" });
        })
        .catch(() => {
          toast({ title: "Error", description: "Failed to update person", variant: "destructive" });
        })
        .finally(() => setLoading(false));
    } else {
      setEditMode(!editMode);
    }
  };

  const handleHide = (hidden: boolean) => {
    setLoading(true);
    return updatePerson(person.id, { isHidden: hidden })
      .then(() => setFormData((p) => ({ ...p, isHidden: hidden })))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleMerge = async (option: AutocompleteOption) => {
    await mergePerson(person.id, [option.value]);
  };

  return (
    <div
      className={clsx(
        "group relative flex flex-col rounded-xl overflow-hidden border bg-card transition-all duration-200",
        "hover:shadow-lg hover:border-border/80",
        {
          "opacity-40": formData.isHidden,
          "border-blue-500/60 shadow-blue-500/10 shadow-md": formData.name,
          "border-border/40": !formData.name,
        }
      )}
    >
      {/* Image area */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {person.thumbnailPath ? (
          <img
            src={person.thumbnailPath}
            alt={formData.name || "Unknown"}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-4xl text-muted-foreground/30 font-light select-none">?</span>
          </div>
        )}

        {/* Gradient overlay — always visible at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Asset count — bottom of image */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-white/90 tabular-nums tracking-wide">
            {formData.isHidden && <span className="mr-1 opacity-70">Hidden ·</span>}
            {person.assetCount} assets
          </span>
        </div>

        {/* Action row — slides in from top on hover */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-1.5 translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-200 bg-gradient-to-b from-black/60 to-transparent">
          {/* Left: immich + info links */}
          <div className="flex items-center gap-1">
            <Link
              href={`${exImmichUrl}/people/${person.id}`}
              target="_blank"
              title="Open in Immich"
              className="p-1 rounded-md bg-white/10 hover:bg-white/25 text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href={`/people/${person.id}`}
              title="View details"
              className="p-1 rounded-md bg-white/10 hover:bg-white/25 text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={13} />
            </Link>
          </div>

          {/* Right: hide + share + merge */}
          <div className="flex items-center gap-1">
            <button
              title={formData.isHidden ? "Show person" : "Hide person"}
              disabled={loading}
              onClick={() => handleHide(!formData.isHidden)}
              className="p-1 rounded-md bg-white/10 hover:bg-white/25 text-white transition-colors disabled:opacity-50"
            >
              {formData.isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <ShareAssetsTrigger
              filters={{ personIds: [person.id] }}
              buttonProps={{
                variant: "ghost",
                className: "!p-1 !h-auto !w-auto rounded-md bg-white/10 hover:bg-white/25 text-white hover:text-white [&>svg]:h-[13px] [&>svg]:w-[13px]",
              }}
            />
            <PersonMergeDropdown
              person={person}
              onRemove={onRemove}
              triggerClassName="!p-1 !h-auto !w-auto rounded-md !bg-white/10 hover:!bg-white/25 !text-white !border-transparent text-[10px] leading-none"
            />
          </div>
        </div>
      </div>

      {/* Name + birthday section */}
      <div className="px-2 pt-2 pb-2 flex flex-col gap-1.5">
        {!editMode ? (
          <button
            className="text-left w-full text-sm font-semibold leading-snug hover:text-muted-foreground transition-colors truncate"
            onClick={() => setEditMode(true)}
            title={formData.name || "Click to set name"}
          >
            {formData.name || (
              <span className="text-muted-foreground/50 font-normal italic text-xs">Unknown</span>
            )}
          </button>
        ) : (
          <Autocomplete
            loadOptions={(query: string) =>
              searchPeople(query).then((people) =>
                people.map((p: any) => ({ label: p.name, value: p.id, imageUrl: p.thumbnailPath }))
              )
            }
            type="text"
            className="text-sm font-semibold w-full px-1.5 py-0.5 rounded-md"
            defaultValue={formData.name}
            placeholder="Enter name"
            autoFocus
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            value={formData.name}
            onOptionSelect={(value) => {
              mergeDialogRef.current?.open();
              selectedPerson.current = value;
            }}
            createNewLabel="Save"
            disabled={loading}
            onCreateNew={() => handleEdit()}
          />
        )}

        <PersonBirthdayCell person={person} />
      </div>

      <AlertDialog
        ref={mergeDialogRef}
        title="Merge Person"
        description="Are you sure you want to merge this person with the selected person?"
        onConfirm={() => {
          if (selectedPerson.current) handleMerge(selectedPerson.current);
        }}
      />
    </div>
  );
}

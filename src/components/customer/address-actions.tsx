"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialAddressActionResult } from "@/lib/customer/address-action-state";
import {
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/lib/customer/address-actions";

export function AddressControls({
  id,
  version,
  isDefault,
}: {
  id: string;
  version: number;
  isDefault: boolean;
}) {
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteAddressAction,
    initialAddressActionResult,
  );
  const [defaultState, defaultAction, settingDefault] = useActionState(
    setDefaultAddressAction,
    initialAddressActionResult,
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!isDefault ? (
          <form action={defaultAction}>
            <input type="hidden" name="addressId" value={id} />
            <input type="hidden" name="version" value={version} />
            <Button type="submit" variant="outline" disabled={settingDefault}>
              {settingDefault ? "Actualizando…" : "Hacer predeterminada"}
            </Button>
          </form>
        ) : null}
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "¿Eliminar esta dirección? Esta acción no se puede deshacer.",
              )
            )
              event.preventDefault();
          }}
        >
          <input type="hidden" name="addressId" value={id} />
          <input type="hidden" name="version" value={version} />
          <Button type="submit" variant="destructive" disabled={deleting}>
            {deleting ? "Eliminando…" : "Eliminar"}
          </Button>
        </form>
      </div>
      {deleteState.message ? (
        <p role="alert" className="text-destructive text-sm">
          {deleteState.message}
        </p>
      ) : null}
      {defaultState.message ? (
        <p role="status" className="text-sm">
          {defaultState.message}
        </p>
      ) : null}
    </div>
  );
}

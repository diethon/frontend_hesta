import React, { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  DoorOpen,
  Layers,
  Sparkles,
} from 'lucide-react';
import { getRooms, createRoom, updateRoom, deleteRoom } from '../../services/roomApi';
import type { RoomResponse } from '../../types/room';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { ROOM_ICONS, getRoomIcon } from './roomHelpers';

interface RoomManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: string;
  onRoomsChanged?: () => void;
  onRoomDeleted?: (deletedRoomId: string) => void;
}

export const RoomManagementModal: React.FC<RoomManagementModalProps> = ({
  isOpen,
  onClose,
  homeId,
  onRoomsChanged,
  onRoomDeleted,
}) => {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Create form state ──
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomIcon, setNewRoomIcon] = useState('living');
  const [isCreating, setIsCreating] = useState(false);

  // ── Inline edit state ──
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('living');
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Delete confirmation state ──
  const [roomToDelete, setRoomToDelete] = useState<RoomResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Reusable Fetch rooms for actions ──
  const reloadRooms = useCallback(async () => {
    if (!homeId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getRooms(homeId);
      setRooms(data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách phòng'));
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  // Initial load when modal opens (deferred to next tick to avoid cascading renders warning in React 19)
  useEffect(() => {
    let active = true;
    if (isOpen && homeId) {
      const load = async () => {
        setLoading(true);
        setError('');
        try {
          const data = await getRooms(homeId);
          if (!active) return;
          setRooms(data || []);
        } catch (err) {
          if (!active) return;
          setError(getErrorMessage(err, 'Không thể tải danh sách phòng'));
        } finally {
          if (active) setLoading(false);
        }
      };

      const timer = setTimeout(() => {
        if (active) {
          setEditingRoomId(null);
          setRoomToDelete(null);
          setNewRoomName('');
          setError('');
          void load();
        }
      }, 0);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [isOpen, homeId]);

  // ── Handle Add Room ──
  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newRoomName.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    setError('');
    try {
      await createRoom(homeId, {
        name: trimmed,
        icon: newRoomIcon,
      });
      setNewRoomName('');
      notify.success('Đã thêm phòng mới', trimmed);
      await reloadRooms();
      onRoomsChanged?.();
    } catch (err) {
      const msg = getErrorMessage(err, 'Không thể tạo phòng mới');
      setError(msg);
      notify.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // ── Handle Start Edit ──
  const handleStartEdit = (room: RoomResponse) => {
    setEditingRoomId(room.id);
    setEditName(room.name);
    setEditIcon(room.icon || 'living');
  };

  const handleCancelEdit = () => {
    setEditingRoomId(null);
    setEditName('');
  };

  // ── Handle Save Edit ──
  const handleSaveEdit = async (roomId: string) => {
    const trimmed = editName.trim();
    if (!trimmed || isUpdating) return;

    setIsUpdating(true);
    setError('');
    try {
      await updateRoom(homeId, roomId, {
        name: trimmed,
        icon: editIcon,
      });
      notify.success('Cập nhật phòng thành công', trimmed);
      setEditingRoomId(null);
      await reloadRooms();
      onRoomsChanged?.();
    } catch (err) {
      const msg = getErrorMessage(err, 'Không thể cập nhật thông tin phòng');
      setError(msg);
      notify.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Handle Safe Delete ──
  const handleConfirmDelete = async () => {
    if (!roomToDelete || isDeleting) return;

    setIsDeleting(true);
    setError('');
    try {
      await deleteRoom(homeId, roomToDelete.id);
      notify.success('Đã xóa phòng', roomToDelete.name);
      onRoomDeleted?.(roomToDelete.id);
      setRoomToDelete(null);
      await reloadRooms();
      onRoomsChanged?.();
    } catch (err) {
      const msg = getErrorMessage(err, 'Không thể xóa phòng');
      setError(msg);
      notify.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-management-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0f172a]/55 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl shadow-2xl border border-[var(--border)] bg-[var(--solid)] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[var(--border)] bg-[var(--g1)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center shrink-0 shadow-xs">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="room-management-title" className="text-lg font-bold text-[var(--text)]">
                Quản Lý Phòng
              </h2>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Tổ chức và phân loại thiết bị theo từng không gian sống trong nhà
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {error && (
            <div className="p-3.5 text-xs font-medium text-rose-700 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Add New Room Card ── */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--g1)] space-y-3">
            <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              Thêm phòng mới
            </h3>

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={50}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Nhập tên phòng (VD: Phòng khách, Bếp, Sân thượng...)"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] placeholder:text-[var(--tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
                  disabled={isCreating}
                />
                <button
                  type="submit"
                  disabled={!newRoomName.trim() || isCreating}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Đang thêm...' : 'Thêm phòng'}</span>
                </button>
              </div>

              {/* Icon selector pills */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--secondary)] mb-1.5">
                  Biểu tượng không gian:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ROOM_ICONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = newRoomIcon === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setNewRoomIcon(item.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-2xs scale-102 font-semibold'
                            : 'bg-[var(--solid)] border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          </div>

          {/* ── Room List Section ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--secondary)]" />
                Danh sách phòng ({rooms.length})
              </h3>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[var(--secondary)]">
                Đang tải danh sách phòng...
              </div>
            ) : rooms.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-2xl bg-[var(--g1)]/40 space-y-1">
                <DoorOpen className="w-8 h-8 text-[var(--secondary)] mx-auto opacity-50 mb-2" />
                <p className="text-sm font-bold text-[var(--text)]">Chưa có phòng nào</p>
                <p className="text-xs text-[var(--secondary)]">
                  Hãy thêm phòng đầu tiên để bắt đầu phân loại thiết bị trong nhà.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => {
                  const isEditing = editingRoomId === room.id;
                  const RoomIcon = getRoomIcon(room.icon);
                  const devCount = room.deviceCount ?? 0;

                  if (isEditing) {
                    return (
                      <div
                        key={room.id}
                        className="p-3.5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={50}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={!editName.trim() || isUpdating}
                            onClick={() => handleSaveEdit(room.id)}
                            className="p-2 rounded-xl bg-[var(--accent)] text-white hover:opacity-95 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Lưu thay đổi"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-2 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
                            title="Hủy"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Edit Icon selector */}
                        <div className="flex flex-wrap gap-1">
                          {ROOM_ICONS.map((item) => {
                            const IconComp = item.icon;
                            const isSelected = editIcon === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setEditIcon(item.id)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold'
                                    : 'bg-[var(--solid)] border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]'
                                }`}
                              >
                                <IconComp className="w-3 h-3" />
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)] hover:border-[var(--accent)]/40 transition-all shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[var(--g1)] text-[var(--text)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                          <RoomIcon className="w-4 h-4 text-[var(--accent)]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[var(--text)] truncate">
                            {room.name}
                          </h4>
                          <span className="text-[11px] font-medium mt-0.5 block">
                            {devCount > 0 ? (
                              <span className="text-[var(--accent)] font-semibold bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">
                                {devCount} thiết bị
                              </span>
                            ) : (
                              <span className="text-[var(--tertiary)] bg-[var(--g1)] px-2 py-0.5 rounded-md">
                                Chưa có thiết bị
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(room)}
                          className="p-2 text-[var(--secondary)] hover:text-[var(--accent)] rounded-xl hover:bg-[var(--g1)] transition-colors cursor-pointer"
                          title="Đổi tên và biểu tượng"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoomToDelete(room)}
                          className="p-2 text-[var(--secondary)] hover:text-rose-600 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Xóa phòng này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-[var(--border)] bg-[var(--g1)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* ── Safe Deletion Confirmation Dialog ── */}
      {roomToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#0f172a]/65 backdrop-blur-md p-4 animate-in fade-in zoom-in-95">
          <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border border-[var(--border)] bg-[var(--solid)] space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">
                  Xác nhận xóa phòng
                </h3>
                <p className="text-xs text-[var(--secondary)]">Thao tác này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text)]">
              Bạn có chắc chắn muốn xóa phòng{' '}
              <span className="font-bold text-rose-600">&ldquo;{roomToDelete.name}&rdquo;</span>?
            </p>

            {(roomToDelete.deviceCount ?? 0) > 0 ? (
              <div className="p-4 rounded-2xl border border-amber-600/30 bg-amber-600/10 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <span>🛡️ An toàn phần cứng:</span>
                  <span>Phòng này có {roomToDelete.deviceCount} thiết bị</span>
                </p>
                <p>
                  Khi xóa phòng, các thiết bị sẽ được chuyển về trạng thái{' '}
                  <span className="font-semibold">&ldquo;Chưa gán phòng&rdquo;</span>.
                  Thiết bị phần cứng vẫn giữ nguyên kết nối, trạng thái và lịch sử năng lượng bình thường.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--secondary)]">
                Phòng này hiện không có thiết bị nào. Phòng sẽ được xóa an toàn khỏi hệ thống.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRoomToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--g1)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa phòng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

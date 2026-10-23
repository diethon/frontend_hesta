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

  // ── Fetch rooms ──
  const fetchRoomList = useCallback(async () => {
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

  useEffect(() => {
    if (isOpen) {
      void fetchRoomList();
      setEditingRoomId(null);
      setRoomToDelete(null);
      setNewRoomName('');
      setError('');
    }
  }, [isOpen, fetchRoomList]);

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
      await fetchRoomList();
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
      await fetchRoomList();
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
      await fetchRoomList();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="surface-card w-full max-w-xl rounded-2xl shadow-2xl border border-line flex flex-col max-h-[90vh] overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Quản Lý Phòng</h2>
              <p className="text-xs text-muted">
                Tổ chức và phân loại thiết bị theo từng không gian sống trong nhà
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-icon hover:text-text rounded-lg hover:bg-sidebar-hover transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {error && (
            <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Add New Room Card ── */}
          <div className="p-4 rounded-xl border border-line bg-off-soft/30 space-y-3">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
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
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-line bg-surface text-text placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  disabled={isCreating}
                />
                <button
                  type="submit"
                  disabled={!newRoomName.trim() || isCreating}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Đang thêm...' : 'Thêm phòng'}</span>
                </button>
              </div>

              {/* Icon selector pills */}
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5">
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
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-2xs scale-102'
                            : 'bg-surface border-line text-muted hover:text-text hover:bg-off-soft'
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
              <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted" />
                Danh sách phòng ({rooms.length})
              </h3>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted">
                Đang tải danh sách phòng...
              </div>
            ) : rooms.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-line rounded-xl bg-off-soft/20 space-y-1">
                <DoorOpen className="w-8 h-8 text-muted mx-auto opacity-50 mb-2" />
                <p className="text-sm font-medium text-text">Chưa có phòng nào</p>
                <p className="text-xs text-muted">
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
                        className="p-3.5 rounded-xl border border-primary/40 bg-primary/5 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={50}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-line bg-surface text-text focus:outline-none focus:border-primary"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={!editName.trim() || isUpdating}
                            onClick={() => handleSaveEdit(room.id)}
                            className="p-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                            title="Lưu thay đổi"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-2 rounded-lg border border-line text-muted hover:text-text hover:bg-surface transition-colors"
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
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                                  isSelected
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-surface border-line text-muted hover:text-text'
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
                      className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface hover:border-primary/30 transition-all shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-off-soft text-text flex items-center justify-center shrink-0 border border-line">
                          <RoomIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-text truncate">
                            {room.name}
                          </h4>
                          <span className="text-[11px] text-muted font-medium">
                            {devCount > 0 ? (
                              <span className="text-primary font-semibold">
                                {devCount} thiết bị
                              </span>
                            ) : (
                              'Chưa có thiết bị'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(room)}
                          className="p-1.5 text-icon hover:text-primary rounded-lg hover:bg-off-soft transition-colors"
                          title="Đổi tên và biểu tượng"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoomToDelete(room)}
                          className="p-1.5 text-icon hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
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
        <div className="flex items-center justify-end px-6 py-3 border-t border-line bg-off-soft/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-line bg-surface text-text hover:bg-off-soft transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* ── Safe Deletion Confirmation Dialog ── */}
      {roomToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in zoom-in-95">
          <div className="surface-card w-full max-w-md p-6 rounded-2xl shadow-2xl border border-line space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">
                  Xác nhận xóa phòng
                </h3>
                <p className="text-xs text-muted">Thao tác này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-text">
              Bạn có chắc chắn muốn xóa phòng{' '}
              <span className="font-bold text-rose-600">&ldquo;{roomToDelete.name}&rdquo;</span>?
            </p>

            {(roomToDelete.deviceCount ?? 0) > 0 ? (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="text-amber-600">🛡️ An toàn phần cứng:</span>
                  Phòng này có {roomToDelete.deviceCount} thiết bị
                </p>
                <p>
                  Khi xóa phòng, các thiết bị sẽ được chuyển về trạng thái{' '}
                  <span className="font-semibold">&ldquo;Chưa gán phòng&rdquo;</span>.
                  Thiết bị phần cứng vẫn giữ nguyên kết nối, trạng thái và lịch sử năng lượng bình thường.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted">
                Phòng này hiện không có thiết bị nào. Phòng sẽ được xóa an toàn khỏi hệ thống.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRoomToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-muted hover:text-text transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50"
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

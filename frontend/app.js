const { createApp, ref, reactive, onMounted, computed, watch, nextTick } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

const API_BASE = 'http://localhost:8000/api';
const UPLOAD_BASE = 'http://localhost:8000';

const axiosInstance = axios.create({ baseURL: API_BASE });

const CATEGORIES = ['服务器', '网络设备', '电脑', '打印机', '监控', '其他'];
const STATUSES = ['正常', '故障', '维修中', '已报废'];
const INSPECTION_TYPES = ['每日', '每周', '每月', '每季', '自定义'];
const INSPECTION_ITEMS = ['温度检查', '指示灯状态', '清洁除尘', '线缆检查', '系统日志', '性能检查', '备份检查', '安全检查'];
const REPAIR_STATUSES = ['待处理', '处理中', '已完成'];

const Dashboard = {
    template: `
        <div>
            <div class="page-header">
                <h1>仪表盘</h1>
            </div>
            
            <div class="stat-cards">
                <div class="stat-card">
                    <div class="number">{{ stats.total_devices }}</div>
                    <div class="label">设备总数</div>
                </div>
                <div class="stat-card success">
                    <div class="number">{{ stats.normal_devices }}</div>
                    <div class="label">正常设备</div>
                </div>
                <div class="stat-card danger">
                    <div class="number">{{ stats.anomaly_devices }}</div>
                    <div class="label">异常设备</div>
                </div>
                <div class="stat-card warning">
                    <div class="number">{{ stats.today_inspection }}</div>
                    <div class="label">今日待巡检</div>
                </div>
                <div class="stat-card danger">
                    <div class="number">{{ stats.overdue_count }}</div>
                    <div class="label">逾期未巡检</div>
                </div>
                <div class="stat-card warning">
                    <div class="number">{{ stats.warranty_soon }}</div>
                    <div class="label">保修期即将到期</div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="card">
                    <h3 style="margin-bottom: 16px;">设备分类占比</h3>
                    <div class="chart-wrapper">
                        <canvas ref="pieChart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 16px;">巡检完成率趋势（近30天）</h3>
                    <div class="chart-wrapper">
                        <canvas ref="lineChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="charts-container" style="margin-top: 20px;">
                <div class="card">
                    <h3 style="margin-bottom: 16px;">巡检到期提醒（7天内）</h3>
                    <ul class="reminder-list" v-if="reminders.inspection_reminders.length">
                        <li v-for="item in reminders.inspection_reminders" :key="item.id">
                            <span>{{ item.device_name }}</span>
                            <span class="reminder-date">{{ item.next_inspection_date }}</span>
                        </li>
                    </ul>
                    <p style="color: #999; text-align: center; padding: 20px;" v-else>暂无提醒</p>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 16px;">保修期到期提醒（30天内）</h3>
                    <ul class="reminder-list" v-if="reminders.warranty_reminders.length">
                        <li v-for="item in reminders.warranty_reminders" :key="item.id">
                            <span>{{ item.name }}</span>
                            <span class="reminder-date">{{ item.warranty_date }}</span>
                        </li>
                    </ul>
                    <p style="color: #999; text-align: center; padding: 20px;" v-else>暂无提醒</p>
                </div>
            </div>
        </div>
    `,
    setup() {
        const stats = ref({
            total_devices: 0, normal_devices: 0, anomaly_devices: 0,
            today_inspection: 0, overdue_count: 0, warranty_soon: 0,
            category_stats: [], trend_data: []
        });
        const reminders = ref({ inspection_reminders: [], warranty_reminders: [] });
        const pieChart = ref(null);
        const lineChart = ref(null);
        let pieChartInstance = null;
        let lineChartInstance = null;

        const loadData = async () => {
            try {
                const [statsRes, remindersRes] = await Promise.all([
                    axiosInstance.get('/dashboard/stats'),
                    axiosInstance.get('/dashboard/reminders')
                ]);
                stats.value = statsRes.data;
                reminders.value = remindersRes.data;
                nextTick(() => {
                    renderCharts();
                });
            } catch (e) {
                ElementPlus.ElMessage.error('加载数据失败');
            }
        };

        const renderCharts = () => {
            if (pieChart.value) {
                if (pieChartInstance) pieChartInstance.destroy();
                const ctx = pieChart.value.getContext('2d');
                pieChartInstance = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: stats.value.category_stats.length ? stats.value.category_stats.map(s => s.category) : ['暂无数据'],
                        datasets: [{
                            data: stats.value.category_stats.length ? stats.value.category_stats.map(s => s.count) : [1],
                            backgroundColor: stats.value.category_stats.length ? ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'] : ['#d9d9d9']
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: true,
                        aspectRatio: 1.5,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }

            if (lineChart.value) {
                if (lineChartInstance) lineChartInstance.destroy();
                const ctx = lineChart.value.getContext('2d');
                lineChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: stats.value.trend_data.length ? stats.value.trend_data.map(d => d.date) : ['暂无数据'],
                        datasets: [
                            {
                                label: '巡检总数',
                                data: stats.value.trend_data.length ? stats.value.trend_data.map(d => d.total) : [0],
                                borderColor: '#1890ff',
                                fill: false,
                                tension: 0.1
                            },
                            {
                                label: '正常完成',
                                data: stats.value.trend_data.length ? stats.value.trend_data.map(d => d.completed) : [0],
                                borderColor: '#52c41a',
                                fill: false,
                                tension: 0.1
                            }
                        ]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        plugins: {
                            legend: { position: 'bottom' }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }
        };

        onMounted(() => loadData());

        return { stats, reminders, pieChart, lineChart };
    }
};

const DeviceList = {
    template: `
        <div>
            <div class="page-header">
                <h1>设备管理</h1>
                <div>
                    <button class="btn btn-default" @click="showImport = true">导入Excel</button>
                    <button class="btn btn-default" @click="exportDevices">导出Excel</button>
                    <button class="btn btn-primary" @click="openModal()">新增设备</button>
                </div>
            </div>
            
            <div class="filter-bar">
                <select v-model="filters.category" @change="loadDevices">
                    <option value="">全部分类</option>
                    <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                </select>
                <select v-model="filters.status" @change="loadDevices">
                    <option value="">全部状态</option>
                    <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
                </select>
                <input type="text" v-model="filters.keyword" placeholder="搜索设备名称/编号/品牌" style="flex: 1; min-width: 200px; padding: 8px; border: 1px solid #d9d9d9; border-radius: 4px;" @keyup.enter="loadDevices">
                <button class="btn btn-default" @click="loadDevices">搜索</button>
            </div>
            
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>设备名称</th>
                            <th>型号/品牌</th>
                            <th>资产编号</th>
                            <th>分类</th>
                            <th>位置</th>
                            <th>状态</th>
                            <th>购买日期</th>
                            <th>保修期</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="d in devices" :key="d.id">
                            <td>{{ d.id }}</td>
                            <td>{{ d.name }}</td>
                            <td>{{ d.brand }} {{ d.model }}</td>
                            <td>{{ d.asset_no }}</td>
                            <td>{{ d.category }}</td>
                            <td>{{ d.location }}</td>
                            <td>
                                <span :class="['tag', d.status === '正常' ? 'tag-normal' : d.status === '故障' ? 'tag-danger' : 'tag-warning']">
                                    {{ d.status }}
                                </span>
                            </td>
                            <td>{{ d.purchase_date }}</td>
                            <td>{{ d.warranty_date }}</td>
                            <td>
                                <button class="btn btn-default" @click="openModal(d)">编辑</button>
                                <button class="btn btn-danger" @click="deleteDevice(d)">删除</button>
                            </td>
                        </tr>
                        <tr v-if="!devices.length">
                            <td colspan="10" style="text-align: center; color: #999; padding: 40px;">暂无数据</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
                <div class="modal">
                    <div class="modal-header">
                        <h3>{{ editingDevice.id ? '编辑设备' : '新增设备' }}</h3>
                        <span class="modal-close" @click="showModal = false">&times;</span>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>设备名称 *</label>
                            <input v-model="form.name" type="text">
                        </div>
                        <div class="form-group">
                            <label>资产编号</label>
                            <input v-model="form.asset_no" type="text">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>品牌</label>
                            <input v-model="form.brand" type="text">
                        </div>
                        <div class="form-group">
                            <label>型号</label>
                            <input v-model="form.model" type="text">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>分类</label>
                            <select v-model="form.category">
                                <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>状态</label>
                            <select v-model="form.status">
                                <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>位置/存放地点</label>
                        <input v-model="form.location" type="text">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>购买日期</label>
                            <input v-model="form.purchase_date" type="date">
                        </div>
                        <div class="form-group">
                            <label>保修期</label>
                            <input v-model="form.warranty_date" type="date">
                        </div>
                    </div>
                    <div class="form-footer">
                        <button class="btn btn-default" @click="showModal = false">取消</button>
                        <button class="btn btn-primary" @click="saveDevice">保存</button>
                    </div>
                </div>
            </div>
            
            <div v-if="showImport" class="modal-overlay" @click.self="showImport = false">
                <div class="modal">
                    <div class="modal-header">
                        <h3>导入设备Excel</h3>
                        <span class="modal-close" @click="showImport = false">&times;</span>
                    </div>
                    <div class="form-group">
                        <label>选择Excel文件</label>
                        <input type="file" ref="fileInput" accept=".xlsx,.xls" @change="handleFileSelect">
                    </div>
                    <p style="color: #666; font-size: 12px; margin-bottom: 16px;">
                        Excel表头需包含：设备名称、型号、品牌、资产编号、分类、位置、购买日期、保修期、状态
                    </p>
                    <div class="form-footer">
                        <button class="btn btn-default" @click="showImport = false">取消</button>
                        <button class="btn btn-primary" @click="importDevices">导入</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const devices = ref([]);
        const showModal = ref(false);
        const showImport = ref(false);
        const editingDevice = ref({});
        const fileInput = ref(null);
        const selectedFile = ref(null);
        const filters = reactive({ category: '', status: '', keyword: '' });
        const form = reactive({
            name: '', model: '', brand: '', asset_no: '',
            category: '其他', location: '', purchase_date: '',
            warranty_date: '', status: '正常', photo: ''
        });

        const loadDevices = async () => {
            try {
                const res = await axiosInstance.get('/devices', { params: filters });
                devices.value = res.data;
            } catch (e) {
                ElementPlus.ElMessage.error('加载失败');
            }
        };

        const openModal = (device = null) => {
            if (device) {
                editingDevice.value = { ...device };
                Object.assign(form, device);
            } else {
                editingDevice.value = {};
                Object.assign(form, {
                    name: '', model: '', brand: '', asset_no: '',
                    category: '其他', location: '', purchase_date: '',
                    warranty_date: '', status: '正常', photo: ''
                });
            }
            showModal.value = true;
        };

        const saveDevice = async () => {
            if (!form.name) {
                ElementPlus.ElMessage.warning('请输入设备名称');
                return;
            }
            try {
                if (editingDevice.value.id) {
                    await axiosInstance.put(`/devices/${editingDevice.value.id}`, form);
                    ElementPlus.ElMessage.success('更新成功');
                } else {
                    await axiosInstance.post('/devices', form);
                    ElementPlus.ElMessage.success('创建成功');
                }
                showModal.value = false;
                loadDevices();
            } catch (e) {
                ElementPlus.ElMessage.error(e.response?.data?.error || '操作失败');
            }
        };

        const deleteDevice = async (d) => {
            if (!confirm(`确定删除设备 "${d.name}" 吗？相关的巡检计划和记录也会被删除。`)) return;
            try {
                await axiosInstance.delete(`/devices/${d.id}`);
                ElementPlus.ElMessage.success('删除成功');
                loadDevices();
            } catch (e) {
                ElementPlus.ElMessage.error('删除失败');
            }
        };

        const handleFileSelect = (e) => {
            selectedFile.value = e.target.files[0];
        };

        const importDevices = async () => {
            if (!selectedFile.value) {
                ElementPlus.ElMessage.warning('请选择文件');
                return;
            }
            const fd = new FormData();
            fd.append('file', selectedFile.value);
            try {
                const res = await axiosInstance.post('/devices/import', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                ElementPlus.ElMessage.success(res.data.message);
                showImport.value = false;
                loadDevices();
            } catch (e) {
                ElementPlus.ElMessage.error(e.response?.data?.error || '导入失败');
            }
        };

        const exportDevices = () => {
            window.open(`${API_BASE}/export/devices`, '_blank');
        };

        onMounted(() => loadDevices());

        return {
            devices, showModal, showImport, editingDevice, form, filters,
            fileInput, CATEGORIES, STATUSES,
            loadDevices, openModal, saveDevice, deleteDevice,
            handleFileSelect, importDevices, exportDevices
        };
    }
};

const PlanList = {
    template: `
        <div>
            <div class="page-header">
                <h1>巡检计划</h1>
                <button class="btn btn-primary" @click="openModal()">新增计划</button>
            </div>
            
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>设备</th>
                            <th>巡检类型</th>
                            <th>巡检项目</th>
                            <th>最近巡检</th>
                            <th>下次巡检</th>
                            <th>负责人</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in plans" :key="p.id">
                            <td>{{ p.id }}</td>
                            <td>{{ p.device_name }}</td>
                            <td>{{ p.inspection_type }}{{ p.inspection_type === '自定义' ? '(' + p.custom_days + '天)' : '' }}</td>
                            <td>
                                <span v-for="(item, idx) in p.items" :key="idx" class="tag tag-info" style="margin-right: 4px; margin-bottom: 4px;">
                                    {{ item }}
                                </span>
                            </td>
                            <td>{{ p.last_inspection_date || '-' }}</td>
                            <td>
                                <span :class="['tag', isOverdue(p.next_inspection_date) ? 'tag-danger' : 'tag-warning']" v-if="p.next_inspection_date">
                                    {{ p.next_inspection_date }}
                                </span>
                                <span v-else>-</span>
                            </td>
                            <td>{{ p.responsible_person }}</td>
                            <td>
                                <button class="btn btn-default" @click="openModal(p)">编辑</button>
                                <button class="btn btn-danger" @click="deletePlan(p)">删除</button>
                            </td>
                        </tr>
                        <tr v-if="!plans.length">
                            <td colspan="8" style="text-align: center; color: #999; padding: 40px;">暂无数据</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
                <div class="modal">
                    <div class="modal-header">
                        <h3>{{ editingPlan.id ? '编辑巡检计划' : '新增巡检计划' }}</h3>
                        <span class="modal-close" @click="showModal = false">&times;</span>
                    </div>
                    <div class="form-group">
                        <label>选择设备 *</label>
                        <select v-model="form.device_id">
                            <option value="">请选择设备</option>
                            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.asset_no }})</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>巡检类型</label>
                            <select v-model="form.inspection_type">
                                <option v-for="t in INSPECTION_TYPES" :key="t" :value="t">{{ t }}</option>
                            </select>
                        </div>
                        <div class="form-group" v-if="form.inspection_type === '自定义'">
                            <label>间隔天数</label>
                            <input v-model.number="form.custom_days" type="number" min="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>巡检项目（可多选）</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                            <label v-for="item in INSPECTION_ITEMS" :key="item" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox" :value="item" v-model="form.items">
                                {{ item }}
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>最近巡检日期</label>
                            <input v-model="form.last_inspection_date" type="date">
                        </div>
                        <div class="form-group">
                            <label>负责人</label>
                            <input v-model="form.responsible_person" type="text">
                        </div>
                    </div>
                    <div class="form-footer">
                        <button class="btn btn-default" @click="showModal = false">取消</button>
                        <button class="btn btn-primary" @click="savePlan">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const plans = ref([]);
        const devices = ref([]);
        const showModal = ref(false);
        const editingPlan = ref({});
        const form = reactive({
            device_id: '', inspection_type: '每周', custom_days: 7,
            items: [], last_inspection_date: '', responsible_person: ''
        });

        const isOverdue = (date) => {
            if (!date) return false;
            return new Date(date) < new Date(new Date().toDateString());
        };

        const loadData = async () => {
            try {
                const [plansRes, devicesRes] = await Promise.all([
                    axiosInstance.get('/plans'),
                    axiosInstance.get('/devices')
                ]);
                plans.value = plansRes.data;
                devices.value = devicesRes.data;
            } catch (e) {
                ElementPlus.ElMessage.error('加载失败');
            }
        };

        const openModal = (plan = null) => {
            if (plan) {
                editingPlan.value = { ...plan };
                Object.assign(form, {
                    device_id: plan.device_id,
                    inspection_type: plan.inspection_type,
                    custom_days: plan.custom_days || 7,
                    items: plan.items || [],
                    last_inspection_date: plan.last_inspection_date || '',
                    responsible_person: plan.responsible_person || ''
                });
            } else {
                editingPlan.value = {};
                Object.assign(form, {
                    device_id: '', inspection_type: '每周', custom_days: 7,
                    items: [], last_inspection_date: '', responsible_person: ''
                });
            }
            showModal.value = true;
        };

        const savePlan = async () => {
            if (!form.device_id) {
                ElementPlus.ElMessage.warning('请选择设备');
                return;
            }
            try {
                if (editingPlan.value.id) {
                    await axiosInstance.put(`/plans/${editingPlan.value.id}`, form);
                    ElementPlus.ElMessage.success('更新成功');
                } else {
                    await axiosInstance.post('/plans', form);
                    ElementPlus.ElMessage.success('创建成功');
                }
                showModal.value = false;
                loadData();
            } catch (e) {
                ElementPlus.ElMessage.error(e.response?.data?.error || '操作失败');
            }
        };

        const deletePlan = async (p) => {
            if (!confirm('确定删除该巡检计划吗？')) return;
            try {
                await axiosInstance.delete(`/plans/${p.id}`);
                ElementPlus.ElMessage.success('删除成功');
                loadData();
            } catch (e) {
                ElementPlus.ElMessage.error('删除失败');
            }
        };

        onMounted(() => loadData());

        return {
            plans, devices, showModal, editingPlan, form,
            INSPECTION_TYPES, INSPECTION_ITEMS, isOverdue,
            loadData, openModal, savePlan, deletePlan
        };
    }
};

const RecordList = {
    template: `
        <div>
            <div class="page-header">
                <h1>巡检记录</h1>
                <div>
                    <button class="btn btn-default" @click="exportRecords">导出Excel</button>
                    <button class="btn btn-primary" @click="openModal()">新增记录</button>
                </div>
            </div>
            
            <div class="filter-bar">
                <select v-model="filters.device_id" @change="loadRecords">
                    <option value="">全部设备</option>
                    <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
                <select v-model="filters.result" @change="loadRecords">
                    <option value="">全部结果</option>
                    <option value="正常">正常</option>
                    <option value="异常">异常</option>
                    <option value="维修中">维修中</option>
                </select>
            </div>
            
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>设备</th>
                            <th>巡检日期</th>
                            <th>结果</th>
                            <th>巡检项目</th>
                            <th>异常描述</th>
                            <th>巡检人</th>
                            <th>照片</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in records" :key="r.id">
                            <td>{{ r.id }}</td>
                            <td>{{ r.device_name }}</td>
                            <td>{{ r.inspection_date }}</td>
                            <td>
                                <span :class="['tag', r.result === '正常' ? 'tag-normal' : r.result === '异常' ? 'tag-danger' : 'tag-warning']">
                                    {{ r.result }}
                                </span>
                            </td>
                            <td>
                                <span v-for="(item, idx) in r.items_detail" :key="idx" class="tag tag-info" style="margin-right: 4px; margin-bottom: 4px;">
                                    {{ item }}
                                </span>
                            </td>
                            <td style="max-width: 200px;">{{ r.anomaly_description || '-' }}</td>
                            <td>{{ r.inspector }}</td>
                            <td>
                                <div class="photo-gallery" v-if="r.photos && r.photos.length">
                                    <img v-for="(p, idx) in r.photos" :key="idx" :src="UPLOAD_BASE + p" class="photo-preview" style="cursor: pointer;" @click="previewPhoto(UPLOAD_BASE + p)">
                                </div>
                                <span v-else>-</span>
                            </td>
                            <td>
                                <button class="btn btn-danger" @click="deleteRecord(r)">删除</button>
                            </td>
                        </tr>
                        <tr v-if="!records.length">
                            <td colspan="9" style="text-align: center; color: #999; padding: 40px;">暂无数据</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
                <div class="modal">
                    <div class="modal-header">
                        <h3>新增巡检记录</h3>
                        <span class="modal-close" @click="showModal = false">&times;</span>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>选择设备 *</label>
                            <select v-model="form.device_id" @change="onDeviceChange">
                                <option value="">请选择设备</option>
                                <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>关联巡检计划</label>
                            <select v-model="form.plan_id">
                                <option value="">无</option>
                                <option v-for="p in devicePlans" :key="p.id" :value="p.id">{{ p.inspection_type }}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>巡检日期</label>
                            <input v-model="form.inspection_date" type="date">
                        </div>
                        <div class="form-group">
                            <label>巡检结果</label>
                            <select v-model="form.result">
                                <option value="正常">正常</option>
                                <option value="异常">异常</option>
                                <option value="维修中">维修中</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>巡检项目（可多选）</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                            <label v-for="item in INSPECTION_ITEMS" :key="item" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox" :value="item" v-model="form.items_detail">
                                {{ item }}
                            </label>
                        </div>
                    </div>
                    <div class="form-group" v-if="form.result === '异常'">
                        <label>异常描述</label>
                        <textarea v-model="form.anomaly_description" placeholder="请详细描述异常情况"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>巡检人</label>
                            <input v-model="form.inspector" type="text">
                        </div>
                        <div class="form-group">
                            <label>上传照片</label>
                            <input type="file" accept="image/*" multiple @change="handlePhotoUpload">
                        </div>
                    </div>
                    <div class="photo-gallery" v-if="form.photos.length">
                        <div v-for="(p, idx) in form.photos" :key="idx" style="position: relative;">
                            <img :src="UPLOAD_BASE + p" class="photo-preview">
                            <span style="position: absolute; top: -5px; right: -5px; background: #f5222d; color: #fff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;" @click="removePhoto(idx)">&times;</span>
                        </div>
                    </div>
                    <div class="form-footer" style="margin-top: 20px;">
                        <button class="btn btn-default" @click="showModal = false">取消</button>
                        <button class="btn btn-primary" @click="saveRecord">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const records = ref([]);
        const devices = ref([]);
        const devicePlans = ref([]);
        const showModal = ref(false);
        const filters = reactive({ device_id: '', result: '' });
        const form = reactive({
            device_id: '', plan_id: '', inspection_date: '',
            result: '正常', items_detail: [], anomaly_description: '',
            inspector: '', photos: []
        });

        const loadRecords = async () => {
            try {
                const res = await axiosInstance.get('/records', { params: filters });
                records.value = res.data;
            } catch (e) {
                ElementPlus.ElMessage.error('加载失败');
            }
        };

        const loadDevices = async () => {
            try {
                const res = await axiosInstance.get('/devices');
                devices.value = res.data;
            } catch (e) {
                ElementPlus.ElMessage.error('加载失败');
            }
        };

        const onDeviceChange = async () => {
            if (form.device_id) {
                try {
                    const res = await axiosInstance.get('/plans');
                    devicePlans.value = res.data.filter(p => p.device_id == form.device_id);
                } catch (e) {
                    devicePlans.value = [];
                }
            } else {
                devicePlans.value = [];
            }
        };

        const openModal = () => {
            Object.assign(form, {
                device_id: '', plan_id: '', inspection_date: new Date().toISOString().split('T')[0],
                result: '正常', items_detail: [], anomaly_description: '',
                inspector: '', photos: []
            });
            devicePlans.value = [];
            showModal.value = true;
        };

        const handlePhotoUpload = async (e) => {
            const files = e.target.files;
            for (let file of files) {
                const fd = new FormData();
                fd.append('file', file);
                try {
                    const res = await axiosInstance.post('/upload', fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    form.photos.push(res.data.url);
                } catch (e) {
                    ElementPlus.ElMessage.error('上传失败');
                }
            }
        };

        const removePhoto = (idx) => {
            form.photos.splice(idx, 1);
        };

        const previewPhoto = (src) => {
            window.open(src, '_blank');
        };

        const saveRecord = async () => {
            if (!form.device_id) {
                ElementPlus.ElMessage.warning('请选择设备');
                return;
            }
            try {
                await axiosInstance.post('/records', form);
                ElementPlus.ElMessage.success('创建成功');
                showModal.value = false;
                loadRecords();
            } catch (e) {
                ElementPlus.ElMessage.error(e.response?.data?.error || '操作失败');
            }
        };

        const deleteRecord = async (r) => {
            if (!confirm('确定删除该记录吗？')) return;
            try {
                await axiosInstance.delete(`/records/${r.id}`);
                ElementPlus.ElMessage.success('删除成功');
                loadRecords();
            } catch (e) {
                ElementPlus.ElMessage.error('删除失败');
            }
        };

        const exportRecords = () => {
            window.open(`${API_BASE}/export/records`, '_blank');
        };

        onMounted(() => {
            loadRecords();
            loadDevices();
        });

        return {
            records, devices, devicePlans, showModal, filters, form,
            INSPECTION_ITEMS, UPLOAD_BASE,
            loadRecords, openModal, onDeviceChange,
            handlePhotoUpload, removePhoto, previewPhoto,
            saveRecord, deleteRecord, exportRecords
        };
    }
};

const RepairList = {
    template: `
        <div>
            <div class="page-header">
                <h1>报修管理</h1>
                <div>
                    <button class="btn btn-default" @click="exportRepairs">导出Excel</button>
                    <button class="btn btn-primary" @click="openModal()">新增报修</button>
                </div>
            </div>
            
            <div class="filter-bar">
                <select v-model="filters.device_id" @change="loadRepairs">
                    <option value="">全部设备</option>
                    <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
                <select v-model="filters.status" @change="loadRepairs">
                    <option value="">全部状态</option>
                    <option v-for="s in REPAIR_STATUSES" :key="s" :value="s">{{ s }}</option>
                </select>
            </div>
            
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>设备</th>
                            <th>报修日期</th>
                            <th>故障描述</th>
                            <th>维修日期</th>
                            <th>维修结果</th>
                            <th>维修费用</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in repairs" :key="r.id">
                            <td>{{ r.id }}</td>
                            <td>{{ r.device_name }}</td>
                            <td>{{ r.report_date }}</td>
                            <td style="max-width: 200px;">{{ r.fault_description }}</td>
                            <td>{{ r.repair_date || '-' }}</td>
                            <td style="max-width: 200px;">{{ r.repair_result || '-' }}</td>
                            <td>¥{{ r.repair_cost || 0 }}</td>
                            <td>
                                <span :class="['tag', r.status === '已完成' ? 'tag-normal' : r.status === '处理中' ? 'tag-warning' : 'tag-danger']">
                                    {{ r.status }}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-default" @click="openModal(r)">编辑</button>
                                <button class="btn btn-danger" @click="deleteRepair(r)">删除</button>
                            </td>
                        </tr>
                        <tr v-if="!repairs.length">
                            <td colspan="9" style="text-align: center; color: #999; padding: 40px;">暂无数据</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
                <div class="modal">
                    <div class="modal-header">
                        <h3>{{ editingRepair.id ? '编辑报修' : '新增报修' }}</h3>
                        <span class="modal-close" @click="showModal = false">&times;</span>
                    </div>
                    <div class="form-group">
                        <label>选择设备 *</label>
                        <select v-model="form.device_id">
                            <option value="">请选择设备</option>
                            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.asset_no }})</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>报修日期</label>
                            <input v-model="form.report_date" type="date">
                        </div>
                        <div class="form-group">
                            <label>状态</label>
                            <select v-model="form.status">
                                <option v-for="s in REPAIR_STATUSES" :key="s" :value="s">{{ s }}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>故障描述 *</label>
                        <textarea v-model="form.fault_description" placeholder="请详细描述故障情况"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>维修日期</label>
                            <input v-model="form.repair_date" type="date">
                        </div>
                        <div class="form-group">
                            <label>维修费用</label>
                            <input v-model.number="form.repair_cost" type="number" min="0" step="0.01">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>维修结果</label>
                        <textarea v-model="form.repair_result" placeholder="请填写维修结果"></textarea>
                    </div>
                    <div class="form-footer">
                        <button class="btn btn-default" @click="showModal = false">取消</button>
                        <button class="btn btn-primary" @click="saveRepair">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const repairs = ref([]);
        const devices = ref([]);
        const showModal = ref(false);
        const editingRepair = ref({});
        const filters = reactive({ device_id: '', status: '' });
        const form = reactive({
            device_id: '', report_date: '', fault_description: '',
            repair_date: '', repair_result: '', repair_cost: 0,
            status: '待处理'
        });

        const loadRepairs = async () => {
            try {
                const res = await axiosInstance.get('/repairs', { params: filters });
                repairs.value = res.data;
            } catch (e) {
                ElementPlus.ElMessage.error('加载失败');
            }
        };

        const loadDevices = async () => {
            try {
                const res = await axiosInstance.get('/devices');
                devices.value = res.data;
            } catch (e) {
                ElementPlus.ElMessage.error('加载失败');
            }
        };

        const openModal = (repair = null) => {
            if (repair) {
                editingRepair.value = { ...repair };
                Object.assign(form, repair);
            } else {
                editingRepair.value = {};
                Object.assign(form, {
                    device_id: '', report_date: new Date().toISOString().split('T')[0],
                    fault_description: '', repair_date: '', repair_result: '',
                    repair_cost: 0, status: '待处理'
                });
            }
            showModal.value = true;
        };

        const saveRepair = async () => {
            if (!form.device_id || !form.fault_description) {
                ElementPlus.ElMessage.warning('请填写必填项');
                return;
            }
            try {
                if (editingRepair.value.id) {
                    await axiosInstance.put(`/repairs/${editingRepair.value.id}`, form);
                    ElementPlus.ElMessage.success('更新成功');
                } else {
                    await axiosInstance.post('/repairs', form);
                    ElementPlus.ElMessage.success('创建成功');
                }
                showModal.value = false;
                loadRepairs();
            } catch (e) {
                ElementPlus.ElMessage.error(e.response?.data?.error || '操作失败');
            }
        };

        const deleteRepair = async (r) => {
            if (!confirm('确定删除该报修记录吗？')) return;
            try {
                await axiosInstance.delete(`/repairs/${r.id}`);
                ElementPlus.ElMessage.success('删除成功');
                loadRepairs();
            } catch (e) {
                ElementPlus.ElMessage.error('删除失败');
            }
        };

        const exportRepairs = () => {
            window.open(`${API_BASE}/export/repairs`, '_blank');
        };

        onMounted(() => {
            loadRepairs();
            loadDevices();
        });

        return {
            repairs, devices, showModal, editingRepair, filters, form,
            REPAIR_STATUSES,
            loadRepairs, openModal, saveRepair, deleteRepair, exportRepairs
        };
    }
};

const App = {
    template: `
        <div class="app-container">
            <div class="sidebar">
                <h2>设备巡检系统</h2>
                <div class="menu-item" :class="{ active: $route.path === '/' }" @click="$router.push('/')">
                    📊 仪表盘
                </div>
                <div class="menu-item" :class="{ active: $route.path === '/devices' }" @click="$router.push('/devices')">
                    💻 设备管理
                </div>
                <div class="menu-item" :class="{ active: $route.path === '/plans' }" @click="$router.push('/plans')">
                    📅 巡检计划
                </div>
                <div class="menu-item" :class="{ active: $route.path === '/records' }" @click="$router.push('/records')">
                    📝 巡检记录
                </div>
                <div class="menu-item" :class="{ active: $route.path === '/repairs' }" @click="$router.push('/repairs')">
                    🔧 报修管理
                </div>
            </div>
            <div class="main-content">
                <router-view></router-view>
            </div>
        </div>
    `
};

const routes = [
    { path: '/', component: Dashboard },
    { path: '/devices', component: DeviceList },
    { path: '/plans', component: PlanList },
    { path: '/records', component: RecordList },
    { path: '/repairs', component: RepairList }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

const app = createApp(App);
app.use(router);
app.use(ElementPlus);
app.mount('#app');
